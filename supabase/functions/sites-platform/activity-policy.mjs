export const MAX_ACTIVITY_AGE=86400000;
export function explicitProof(row,now=Date.now()){
 if(row?.kind!=='property')return true;
 try{
 const f=row.facts||{},u=new URL(row.url);
 const legacy=/^https:\/\/www\.(immobilier\.notaires\.fr|biddit\.be)\//.test(row.url);
 const stamp=f.checked_at||(legacy?row.last_seen:null),checked=Date.parse(stamp);
 if(u.protocol!=='https:'||u.username||u.password||f.source_listing_state!=='active'||typeof f.source_status_evidence!=='string'||f.source_status_evidence.trim().length<12)return false;
 if((f.activity_record_url||(!legacy?null:row.url))!==row.url)return false;
 if(!/(Z|[+-]\d\d:\d\d)$/.test(String(stamp))||!Number.isFinite(checked)||checked>now||now-checked>MAX_ACTIVITY_AGE)return false;
 const e=new URL(f.activity_evidence_url||f.evidence_url||row.url);
 if(e.protocol!=='https:'||e.username||e.password||e.hostname.replace(/^www\./,'')!==u.hostname.replace(/^www\./,''))return false;
 for(const k of ['deadline','auction_at','bid_deadline_at'])if(f[k]){const end=Date.parse(f[k]);if(!Number.isFinite(end)||end<=now)return false;}
 return true;
 }catch{return false}
}
export function evidenceSQL(url,f,stamp){
 return `${url} ~ '^https://[^/@ ]+/'
 and coalesce(${f}->>'activity_evidence_url',${f}->>'evidence_url',${url}) ~ '^https://[^/@ ]+/'
 and lower(regexp_replace(substring(${url} from '^https://([^/:]+)'),'^(www[.])',''))=lower(regexp_replace(substring(coalesce(${f}->>'activity_evidence_url',${f}->>'evidence_url',${url}) from '^https://([^/:]+)'),'^(www[.])',''))
 and coalesce((${f}->>'source_listing_state')='active',false)
 and length(trim(coalesce(${f}->>'source_status_evidence','')))>=12
 and coalesce(${f}->>'activity_record_url',case when ${url} ~ '^https://www[.](immobilier[.]notaires[.]fr|biddit[.]be)/' then ${url} end)=${url}
 and site_private.safe_stamp(${stamp}) between now()-interval '24 hours' and now()
 and (coalesce(${f}->>'deadline','')='' or site_private.safe_stamp(${f}->>'deadline')>now())
 and (coalesce(${f}->>'auction_at','')='' or site_private.safe_stamp(${f}->>'auction_at')>now())
 and (coalesce(${f}->>'bid_deadline_at','')='' or site_private.safe_stamp(${f}->>'bid_deadline_at')>now())`;
}
// Unknown availability is retained; only documented closure/elapsed deadlines exclude it.
export function closureState(row,now=Date.now()){
 const f=row?.facts||{};
 if(['expired'].includes(f.source_listing_state))return 'expired';
 if(['removed','sold','withdrawn','inactive','closed'].includes(f.source_listing_state))return 'removed';
 for(const k of ['deadline','auction_at','bid_deadline_at'])if(f[k]&&Number.isFinite(Date.parse(f[k]))&&Date.parse(f[k])<=now)return 'expired';
 return null;
}
export function admissibleListing(row,now=Date.now()){
 return row?.kind!=='property'||!closureState(row,now);
}
export function availabilityLabel(row,now=Date.now()){
 return closureState(row,now)?'Potvrđeno neaktivan':explicitProof(row,now)?'Aktivnost potvrđena':'Dostupnost nije potvrđena';
}
export function retainedSQL(f){
 return `coalesce(${f}->>'source_listing_state','') not in ('expired','removed','sold','withdrawn','inactive','closed')
 and not coalesce(site_private.safe_stamp(${f}->>'deadline')<=now(),false)
 and not coalesce(site_private.safe_stamp(${f}->>'auction_at')<=now(),false)
 and not coalesce(site_private.safe_stamp(${f}->>'bid_deadline_at')<=now(),false)`;
}
const FACTS="(site_private.safe_json(c.body_json)->'facts')";
const SOURCE_PROOF=evidenceSQL('c.url',FACTS,"coalesce(site_private.safe_json(c.body_json)->'facts'->>'checked_at',case when c.url ~ '^https://www[.](immobilier[.]notaires[.]fr|biddit[.]be)/' then c.last_seen end)");
export const SOURCE_ACTIVE=`(${retainedSQL(FACTS)}) and not exists(select 1 from site_private.listing_lifecycle activity_l where activity_l.candidate_id=c.id and activity_l.state in ('expired','removed'))`;
const PROPERTY_OWN=`coalesce(p.status,'') not in ('Prodano','Povučeno','Rok istekao - ishod nepoznat','Zatvoreno')
 and (p.auction_at is null or p.auction_at>now())
 and (p.bid_deadline_at is null or p.bid_deadline_at>now())
 and (site_private.safe_stamp(p.available_until) is null or site_private.safe_stamp(p.available_until)>now())`;
export const PROPERTY_ACTIVE=`${PROPERTY_OWN}
 and p.id not in(select c.property_id from source_candidates c where c.kind='property' and c.property_id is not null and not (${SOURCE_ACTIVE}))
 and coalesce(rtrim(p.source,'/'),'') not in(select rtrim(c.url,'/') from source_candidates c where c.kind='property' and c.url is not null and not (${SOURCE_ACTIVE}))`;
// The same predicates over SOURCE_ACTIVE evaluated once per candidate and transaction by stageSourceState(). Each use
// of PROPERTY_ACTIVE or SOURCE_ACTIVE re-parses every candidate's body_json; a read used them about a dozen times.
// `active` keeps SQL's three-valued result, so `not s.active` and `s.active` select exactly the rows they did before.
export const PROPERTY_ACTIVE_STAGED=`${PROPERTY_OWN}
 and p.id not in(select s.property_id from pg_temp.source_state s where s.kind='property' and s.property_id is not null and not s.active)
 and coalesce(rtrim(p.source,'/'),'') not in(select s.url from pg_temp.source_state s where s.kind='property' and s.url is not null and not s.active)`;
// Must run inside a transaction: the table is private to the session and dropped at commit or rollback. Each call
// rebuilds it, so a later call never sees a state older than data written earlier in the same transaction.
export async function stageSourceState(tx){
 await tx`drop table if exists pg_temp.source_state`;
 await tx`create temp table source_state on commit drop as select c.id,c.kind,c.property_id,rtrim(c.url,'/') as url,(${tx.unsafe(SOURCE_ACTIVE)}) as active from source_candidates c`;
 await tx`create index on pg_temp.source_state(id)`;
 await tx`analyze pg_temp.source_state`;
}
export const PROPERTY_AVAILABILITY=`case when exists(select 1 from source_candidates c where c.kind='property' and rtrim(c.url,'/')=rtrim(p.source,'/') and ${SOURCE_PROOF} and ${SOURCE_ACTIVE})
 or exists(select 1 from activity a where a.property_id=p.id and a.stage='Provjera aktivnosti oglasa' and ${evidenceSQL('p.source','site_private.safe_json(a.notes)',"site_private.safe_json(a.notes)->>'checked_at'")}) then 'Aktivnost potvrđena' else 'Dostupnost nije potvrđena' end`;
