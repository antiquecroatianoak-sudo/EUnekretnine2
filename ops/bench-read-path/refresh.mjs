// Usage: PG_MODULE=... PAIR_DB_URL=... REFRESH=file:///.../refresh-suggestions.mjs node ops/bench-read-path/refresh.mjs <runs> [keep]
// Each run is rolled back unless 'keep' is given.
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const {refreshSuggestions}=await import(process.env.REFRESH);
const sql=postgres(process.env.PAIR_DB_URL,{max:1,onnotice:()=>{}});
const runs=Number(process.argv[2]||1),keep=process.argv[3]==='keep';
for(let k=0;k<runs;k++){const t=Date.now();let n;
 await sql.begin(async tx=>{n=await refreshSuggestions(tx);if(!keep)throw Error('rollback')}).catch(e=>{if(e.message!=='rollback')throw e});
 console.log('refresh',k+1,(Date.now()-t)+' ms','stored',n);}
await sql.end();
