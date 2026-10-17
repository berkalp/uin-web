import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/planRoomTiming.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,Date});
const timing=m.exports.getPlanRoomTiming;
const plan={status:'planned',scheduled_start:'2026-10-17T10:00:00Z',scheduled_end:'2026-10-17T12:00:00Z'};
test('scheduled activity boundaries use one supplied clock snapshot',()=>{
 assert.equal(timing(plan,'activity',Date.parse('2026-10-17T09:59:59Z')).hasScheduledActivityStarted,false);
 assert.equal(timing(plan,'activity',Date.parse(plan.scheduled_start)).hasScheduledActivityStarted,true);
 assert.equal(timing(plan,'activity',Date.parse(plan.scheduled_end)).isScheduledActivityEnded,true);
 assert.equal(timing(plan,'activity',Date.parse('2026-10-24T11:59:59Z')).isOutcomeUnknown,false);
 assert.equal(timing(plan,'activity',Date.parse('2026-10-24T12:00:00Z')).isOutcomeUnknown,true);
});
test('missing, invalid, cancelled and planning dates cannot become overdue activity',()=>{
 for(const [p,phase]of [[{...plan,scheduled_start:null,scheduled_end:null},'activity'],[{...plan,scheduled_start:'bad',scheduled_end:'bad'},'activity'],[{...plan,status:'cancelled'},'activity'],[plan,'planning']])assert.deepEqual(Object.values(timing(p,phase,Date.parse('2027-01-01'))),[false,false,false]);
});
