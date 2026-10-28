// Only reads may be cancelled or timed out here. Writes are never retried or
// reported as unsuccessful merely because a client-side deadline elapsed.
const READS=new Set(['read','pairs','pair','catalog','sources','pair_diagnostics','workflow','buyer_requests']);
export function isReadRequest(init={}){
 const method=String(init.method||'GET').toUpperCase();
 if(method==='GET')return true;
 if(method!=='POST'||typeof init.body!=='string')return false;
 try{return READS.has(JSON.parse(init.body)?.action)}catch{return false}
}
export async function fetchPlatform(init={}, {fetchImpl=globalThis.fetch,timeoutMs=45000}={}){
 const read=isReadRequest(init),controller=read?new AbortController():null;
 const parent=init.signal;
 const cancel=()=>controller?.abort();
 let timer,timedOut=false;
 if(controller){
  if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
 }
 try{
  const response=await fetchImpl('/api/platform',controller?{...init,signal:controller.signal}:init);
  const text=await response.text();
  if(response.status===401)throw Error('Prijava je istekla ili nije dostupna. Ponovno otvori aplikaciju i prijavi se.');
  let data;
  try{data=JSON.parse(text)}catch{throw Error('Odgovor poslužitelja nije valjan (HTTP '+response.status+', '+(text.length>=1e6?(text.length/1e6).toFixed(1)+' MB':Math.ceil(text.length/1e3)+' kB')+')')}
  if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'HTTP '+response.status);
  return data;
 }catch(error){
  if(timedOut){const e=Error('Učitavanje traje predugo. Ako su podaci već učitani, ostaju prikazani. Pokušaj ponovno.');e.name='TimeoutError';throw e}
  throw error;
 }finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel)}
}
