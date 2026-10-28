// TEST ONLY server for the browser checks (e2e/README.md). It is not part of the Sites app and is never deployed:
// it serves the bundled dashboard and answers /api/platform with the real sites-platform dispatch on an isolated
// e2e_* database. There is no login here because there is no production route here; production auth is unchanged.
// /__test/fault (TEST ONLY) makes the next reads fail or stall, to check that errors never show as empty data.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [bundle,port='4317']=process.argv.slice(2);
const url=process.env.E2E_DB_URL;if(!url||!/\/e2e_\w+(\?|$)/.test(url))throw Error('E2E_DB_URL must name an e2e_* database.');
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('../supabase/functions/sites-platform/',import.meta.url),copy=new URL('.e2e-server.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?url:undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const sql=postgres(url,{max:4,prepare:false,onnotice:()=>{}});
let fault={mode:null,count:0};
const READS=new Set(['read','pairs','pair','catalog','sources','pair_diagnostics','workflow','buyer_requests']);
const page=`<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TEST ONLY</title><style>/* TEST ONLY: the canonical global stylesheet is not in this repository. Only two of its jobs are stood in for: the backdrop sits behind the content, and a .table-scroll wrapper scrolls its wide table inside itself (the component wraps tables in it for that purpose). */.graphite-backdrop{position:fixed;inset:0;z-index:-1;overflow:hidden}.graphite-backdrop svg{width:100%;height:100%}.table-scroll{max-width:100%;overflow-x:auto}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;
const send=(res,status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(typeof body==='string'?body:JSON.stringify(body))};
createServer(async(req,res)=>{
 try{
  if(req.url==='/')return send(res,200,page,'text/html; charset=utf-8');
  if(req.url==='/app.js')return send(res,200,readFileSync(bundle,'utf8'),'text/javascript');
  if(req.url.startsWith('/__test/fault')){const q=new URL(req.url,'http://x').searchParams;fault={mode:q.get('mode'),count:Number(q.get('count')||1)};return send(res,200,{ok:true})}
  if(req.url!=='/api/platform')return send(res,404,{error:'Not found'});
  let raw='';for await(const c of req)raw+=c;
  const a=req.method==='GET'?{action:'read'}:JSON.parse(raw||'{}');
  if(READS.has(a.action)&&fault.mode&&fault.count>0){fault.count--;
   if(fault.mode==='error')return send(res,500,{error:'TEST ONLY: baza nije dostupna'});
   if(fault.mode==='invalid')return send(res,200,'<html>nije JSON</html>','text/html')}
  send(res,200,await sql.begin(tx=>dispatch(tx,a)));
 }catch(e){send(res,400,{error:String(e?.message||e)})}
}).listen(Number(port),'127.0.0.1',()=>console.log('e2e server on '+port));
