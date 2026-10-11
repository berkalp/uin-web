import fs from 'node:fs';
const admins=new Map(fs.readFileSync('.cache/geonames/admin1CodesASCII.txt','utf8').split(/\r?\n/).filter(Boolean).map(line=>{const f=line.split('\t');return[f[0],f[1]]}));
const regions=fs.readFileSync('.cache/geonames/cities5000.txt','utf8').split(/\r?\n/).filter(Boolean).map(line=>{const f=line.split('\t'),key=f[8]+'.'+f[10];return ['city:'+f[0],f[10]&&f[10]!=='00'?f[10]:null,admins.get(key)??null]});
const tr=JSON.parse(fs.readFileSync('src/data/cityPopulationCatalogue.json','utf8')).turkeyByTitle;
const template=fs.readFileSync('scripts/place-directory-v172.sql','utf8');
fs.writeFileSync('supabase/migrations/20261011150000_place_directory_and_links_v172.sql',template.replace('__REGIONS__',JSON.stringify(regions)).replace('__TR_POPULATIONS__',JSON.stringify(tr)).replace('notify pgrst',()=>fs.readFileSync('scripts/place-level-compat-v172.sql','utf8')+';\nnotify pgrst'));
