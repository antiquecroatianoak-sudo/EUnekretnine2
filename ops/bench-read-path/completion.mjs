// Usage: PG_MODULE=... PAIR_DB_URL=... node ops/bench-read-path/completion.mjs (time and query count per completion_queue page)
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('../../supabase/functions/sites-platform/',import.meta.url),copy=new URL('.cq-bench.mjs',dir);
globalThis.Deno={env:{get:()=>undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
let queries=0;const sql=postgres(process.env.PAIR_DB_URL,{max:1,prepare:false,onnotice:()=>{},debug:()=>{queries++}});
console.log('stored pairs',(await sql`select count(*)::int n from match_results`)[0].n);queries=0;
for(const a of [{limit:50},{offset:50,limit:50},{limit:200,side:'property'}]){queries=0;const t=Date.now();const r=await sql.begin(tx=>dispatch(tx,{action:'completion_queue',...a}));
 console.log(JSON.stringify(a),(Date.now()-t)+' ms',queries+' queries','items',r.total,'page',r.items.length,(JSON.stringify(r).length/1e3).toFixed(0)+' kB')}
await sql.end();
