import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('the people RPC never substitutes an automatic completion timestamp for an unknown visit date',async()=>{
 const sql=fs.readFileSync('supabase/migrations/20261016114553_respect_experience_date_precision.sql','utf8');
 const fields=sql.slice(sql.indexOf("'experience_precision'"),sql.indexOf("'experience_text'" )).trim().replace(/,$/,'');
 const db=new PGlite();try{
 const cases=[
  ['unknown',null,null,null,null,null,null],
  ['unknown','2020-01-01',2020,'exact',2026,null,null],
  ['year',null,2020,null,null,null,2020],
  ['exact','2020-02-03',null,null,null,'2020-02-03',null],
  [null,null,null,null,null,null,null],
  [null,null,null,'exact',null,'2026-08-30',null],
  [null,null,null,'year',2019,null,2019],
  [null,'2018-01-01',null,null,null,'2018-01-01',null],
 ];
 for(const [precision,date,year,legacyPrecision,legacyYear,wantDate,wantYear] of cases){
  const {rows}=await db.query(`select jsonb_build_object(${fields}) as review
   from (select 'seed'::text source_kind) selected
   cross join (select $1::text experience_precision,$2::date experience_date,$3::int experience_year) personal_state
   cross join (select $4::text completed_date_precision,$5::int completed_year,'2026-08-30'::date completed_at) seed`,[precision,date,year,legacyPrecision,legacyYear]);
  assert.equal(rows[0].review.experience_date,wantDate);
  assert.equal(rows[0].review.experience_year,wantYear);
 }
 }finally{await db.close();}
});
