import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
// Usage: PG_MODULE=... PAIR_DB_URL=... [FN_DIR=file:///.../sites-platform/] node ops/bench-read-path/bench.mjs read,pairs
const dir=new URL(process.env.FN_DIR||'../../supabase/functions/sites-platform/',import.meta.url),copy=new URL('.bench.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?process.env.PAIR_DB_URL:undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const sql=postgres(process.env.PAIR_DB_URL,{max:2,onnotice:()=>{}});
for(const action of (process.argv[2]||'refresh,read,pairs,read,pairs').split(',')){
 const t=Date.now();const r=await sql.begin(tx=>dispatch(tx,action==='catalog'?{action,table:'properties'}:{action}));
 console.log(action,(Date.now()-t)+' ms',(JSON.stringify(r).length/1e6).toFixed(1)+' MB');
}
await sql.end();
