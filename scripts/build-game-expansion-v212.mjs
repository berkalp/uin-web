// Generates small, repeatable SQL transactions for the reviewed game catalogue.
// Apply after migration 20261018153655; personal records are checked in each batch.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(root,'game-expansion-v212.json'),'utf8'));
const template=fs.readFileSync(path.join(root,'game-expansion-v212.template.sql'),'utf8');
const output=path.resolve(process.argv[2]||'work/game-expansion-sql');
fs.mkdirSync(output,{recursive:true});
const batches=[];
for(let i=0;i<data.games.length;i+=35)batches.push({games:data.games.slice(i,i+35),boards:[]});
for(let i=0;i<data.boards.length;i+=10)batches.push({games:[],boards:data.boards.slice(i,i+10)});
for(let i=0;i<batches.length;i++)fs.writeFileSync(path.join(output,`${String(i+1).padStart(2,'0')}.sql`),template.replace('PAYLOAD_JSON',JSON.stringify(batches[i])));
console.log(`${batches.length} SQL transactions generated in ${output}`);
