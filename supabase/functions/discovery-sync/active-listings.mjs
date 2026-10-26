export const ACTIVITY_MAX_AGE=24*60*60*1000;
export function activityValid(url,f,checkedAt,now=Date.now()){
 try{
  const record=new URL(url),proof=new URL(f?.activity_evidence_url),checked=Date.parse(checkedAt);
  if(record.protocol!=='https:'||proof.protocol!=='https:'||record.username||record.password||proof.username||proof.password)return false;
  if(record.hostname.replace(/^www\./,'')!==proof.hostname.replace(/^www\./,''))return false;
  if(!/(Z|[+-]\d\d:\d\d)$/.test(String(checkedAt))||!Number.isFinite(checked)||now<checked||now-checked>ACTIVITY_MAX_AGE)return false;
  if(f.source_listing_state!=='active'||f.activity_record_url!==url||typeof f.source_status_evidence!=='string'||f.source_status_evidence.trim().length<12)return false;
  for(const key of ['deadline','bid_deadline_at','available_until','auction_at'])if(f[key]){
   if(!/(Z|[+-]\d\d:\d\d)$/.test(String(f[key])))return false;
   const end=Date.parse(f[key]);if(!Number.isFinite(end)||end<=now)return false;
  }
  return true;
 }catch{return false}
}
export function candidateActive(r,now=Date.now()){
 return r?.kind!=='property'||activityValid(r.url,r.facts,r.facts?.checked_at,now);
}
