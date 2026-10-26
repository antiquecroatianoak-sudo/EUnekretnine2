import {mergeCandidate} from './merge.mjs';
const urlKey=(kind,url)=>kind+'\n'+url.replace(/\/+$/,'');
// Caller holds the registry import transaction lock. Keep one read, one write
// and one synchronization round trip for the complete bounded batch.
export async function persistBatch(tx,accepted,source){
 if(!accepted.length)return {inserted:0,updated:0};
 const prior=await tx`select * from source_candidates where id=any(${accepted.map(r=>r.id)}::text[]) or (rtrim(url,'/')=any(${accepted.map(r=>r.url.replace(/\/+$/,''))}::text[]) and kind=any(${[...new Set(accepted.map(r=>r.kind))]}::text[])) for update`;
 const byID=new Map(prior.map(r=>[r.id,r])),byURL=new Map(prior.map(r=>[urlKey(r.kind,r.url),r]));
 const writes=new Map(),syncIDs=new Set();let inserted=0,updated=0;
 for(const row of accepted){
  const existing=byID.get(row.id)||byURL.get(urlKey(row.kind,row.url));
  if(existing)updated++;else inserted++;
  const merged=mergeCandidate(existing,row,source),id=merged.id;syncIDs.add(id);
  // Match the existing database timestamp guard; a stale fetch never wins.
  if(existing&&existing.last_seen>row.last_seen)continue;
  const stored={id,source_id:merged.source_id,kind:merged.kind,title:merged.title,country:merged.country,url:merged.url,body_json:JSON.stringify(merged),last_seen:row.last_seen};
  if(existing)byURL.delete(urlKey(existing.kind,existing.url));
  byID.set(id,stored);byURL.set(urlKey(stored.kind,stored.url),stored);writes.set(id,stored);
 }
 const rows=[...writes.values()];
 if(rows.length)await tx`insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen)
  select * from unnest(${rows.map(r=>r.id)}::text[],${rows.map(r=>r.source_id)}::text[],${rows.map(r=>r.kind)}::text[],${rows.map(r=>r.title)}::text[],${rows.map(r=>r.country)}::text[],${rows.map(r=>r.url)}::text[],${rows.map(r=>r.body_json)}::text[],${rows.map(r=>r.last_seen)}::text[])
  on conflict(id) do update set title=excluded.title,country=excluded.country,url=excluded.url,body_json=excluded.body_json,last_seen=excluded.last_seen where source_candidates.last_seen<=excluded.last_seen`;
 await tx`select site_private.sync_source_listing(cid) from unnest(${[...syncIDs]}::text[]) as cid`;
 return {inserted,updated};
}
