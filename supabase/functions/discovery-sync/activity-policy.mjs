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
export const SOURCE_ACTIVE=evidenceSQL('c.url',"(site_private.safe_json(c.body_json)->'facts')","coalesce(site_private.safe_json(c.body_json)->'facts'->>'checked_at',case when c.url ~ '^https://www[.](immobilier[.]notaires[.]fr|biddit[.]be)/' then c.last_seen end)");
export const PROPERTY_ACTIVE=`p.status not in ('Prodano','Povučeno','Rok istekao - ishod nepoznat','Zatvoreno')
 and (rtrim(p.source,'/') in (select rtrim(c.url,'/') from source_candidates c where c.kind='property' and ${SOURCE_ACTIVE})
 or exists(select 1 from activity a where a.property_id=p.id and a.stage='Provjera aktivnosti oglasa' and ${evidenceSQL('p.source','site_private.safe_json(a.notes)',"site_private.safe_json(a.notes)->>'checked_at'")}))
 and not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=p.id and l.state in ('expired','removed','missing_once'))`;

