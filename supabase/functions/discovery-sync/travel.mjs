// Travel time — isolated optional module (plan #46 addendum, module 6). Off: no approved routing service exists
// without new cost or account, so nothing is computed in production and the reason is stated. The contract, queue
// and cache below run only with an injected adapter (tests use a deterministic TEST adapter). Matching never calls a
// service: it reads stored results only, and without one a travel requirement stays visible as "not computed".
export const TRAVEL_VERSION='travel-v1';
export const TRAVEL_CONFIG={enabled:false,provider:null,reason:'Nema odobrenog servisa za rute bez novih troškova ili računa; modul je isključen.'};
export const MODES=['automobil','javni prijevoz','pješice'];
const PRECISE=['poi','adresa'];
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const coord=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
// Request side: [{destination:{name,lat,lon,precision}, mode, max_minutes, mandatory, quote, traffic?}]. A city centre is
// not a destination: only a point of interest or an address is precise enough.
export function validateTravel(list){
 if(!Array.isArray(list)||list.length>10)throw Error('Uvjeti putovanja moraju biti popis (najviše 10).');
 return list.map((t,n)=>{const where='Uvjet putovanja '+(n+1),d=t?.destination;
  if(!d||!text(d.name,200)||!coord(d.lat,d.lon)||!PRECISE.includes(d.precision))throw Error(where+': odredište mora biti točna lokacija (POI ili adresa) s koordinatama.');
  if(!MODES.includes(t.mode))throw Error(where+': nepoznat način putovanja.');
  if(!Number.isInteger(t.max_minutes)||t.max_minutes<1||t.max_minutes>600)throw Error(where+': najveće vrijeme mora biti 1–600 minuta.');
  if(typeof t.mandatory!=='boolean'||!text(t.quote,500))throw Error(where+': potrebni su obaveznost i izvorni navod.');
  if(t.traffic!=null&&!text(t.traffic,200))throw Error(where+': neispravna pretpostavka prometa.');
  return {destination:{name:d.name.trim(),lat:d.lat,lon:d.lon,precision:d.precision},mode:t.mode,max_minutes:t.max_minutes,mandatory:t.mandatory,quote:t.quote.trim(),...(t.traffic?{traffic:t.traffic.trim()}:{})};
 });
}
// Origin: the property's own precise location, never a city centre or an approximate map point.
export function originOf(location){return location&&PRECISE.concat('čestica').includes(location.precision)&&coord(location.lat,location.lon)?location:null}
// Cache key: origin and destination rounded to ~10 m, mode and module version; a moved point is a new key.
export const travelKey=(o,d,mode)=>[TRAVEL_VERSION,o.lat.toFixed(4),o.lon.toFixed(4),d.lat.toFixed(4),d.lon.toFixed(4),mode].join('|');
// Outcome for one requirement from a stored result; never a guess.
export function travelOutcome(t,result,now=Date.now()){
 if(!TRAVEL_CONFIG.enabled&&!result)return {state:'not_computed',reason:TRAVEL_CONFIG.reason};
 if(!result)return {state:'not_computed',reason:'Rezultat još nije izračunat'};
 if(result.error)return {state:'not_computed',reason:'Izračun nije uspio: '+result.error};
 if(result.expires_at<=now)return {state:'not_computed',reason:'Rezultat je zastario; potreban je novi izračun'};
 return {state:result.minutes<=t.max_minutes?'met':'unmet',minutes:result.minutes,source:result.source,computed_at:result.computed_at,assumptions:result.assumptions};
}
// Asynchronous queue: deduplicated keys, TTL cache, bounded parallelism, retry with exponential backoff on a timeout or
// HTTP 429. It never runs inside import or matching; callers enqueue and read results later.
export class TravelQueue{
 constructor({adapter,ttl=30*86400000,concurrency=2,retries=3,backoff=1000,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
  if(!adapter)throw Error('Adapter rute je obavezan.');Object.assign(this,{adapter,ttl,concurrency,retries,backoff,now,sleep});this.cache=new Map();this.pending=new Map();this.active=0;this.waiting=[];this.calls=0;
 }
 get(key){const r=this.cache.get(key);return r&&r.expires_at>this.now()?r:null}
 async slot(){if(this.active<this.concurrency){this.active++;return}await new Promise(r=>this.waiting.push(r));this.active++}
 release(){this.active--;this.waiting.shift()?.()}
 enqueue(origin,destination,mode,traffic=null){
  const o=originOf(origin);if(!o)return Promise.resolve({error:'Lokacija nekretnine nije dovoljno precizna',expires_at:Infinity});
  const key=travelKey(o,destination,mode),hit=this.get(key);if(hit)return Promise.resolve(hit);
  if(this.pending.has(key))return this.pending.get(key);
  const job=(async()=>{await this.slot();try{
   for(let attempt=0;;attempt++){
    try{this.calls++;const r=await this.adapter.route({origin:o,destination,mode,traffic});
     if(!Number.isFinite(r?.minutes)||r.minutes<0)throw Object.assign(Error('Neispravan odgovor servisa'),{fatal:true});
     const out={minutes:Math.round(r.minutes),source:this.adapter.name,computed_at:new Date(this.now()).toISOString(),expires_at:this.now()+this.ttl,assumptions:{mode,traffic:traffic||'bez posebne pretpostavke prometa'}};
     this.cache.set(key,out);return out}
    catch(e){const retry=!e.fatal&&(e.status===429||e.code==='ETIMEDOUT'||e.name==='TimeoutError');
     if(!retry||attempt>=this.retries)return {error:e.status===429?'Ograničenje servisa (429)':e.message||'Greška servisa',expires_at:this.now()+60000};
     await this.sleep(this.backoff*2**attempt)}
   }}finally{this.release();this.pending.delete(key)}})();
  this.pending.set(key,job);return job;
 }
}
// Deterministic TEST adapter: great-circle distance at a fixed speed. It exists only to exercise the queue; its result
// is labelled as a test value and is never a production travel time.
export const testAdapter=(speedKmh=60,{fail=[]}={})=>({name:'TEST ONLY determinističko',route:async({origin:o,destination:d})=>{
 const f=fail.shift();if(f)throw f;
 const R=6371,dl=(d.lat-o.lat)*Math.PI/180,dn=(d.lon-o.lon)*Math.PI/180,a=Math.sin(dl/2)**2+Math.cos(o.lat*Math.PI/180)*Math.cos(d.lat*Math.PI/180)*Math.sin(dn/2)**2;
 return {minutes:2*R*Math.asin(Math.sqrt(a))/speedKmh*60}}});
