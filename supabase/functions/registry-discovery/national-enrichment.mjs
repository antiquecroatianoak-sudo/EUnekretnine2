// Country-scoped enrichment of existing candidates. No listing import or legal clearance.
import {COUNTRIES} from './domain.mjs';
export const VERSION='2026-10-25-v1';
export const isoCountry=value=>Object.hasOwn(COUNTRIES,value)?value:Object.entries(COUNTRIES).find(([,v])=>v===value)?.[0]||null;
export const SERVICES={
 HR:{name:'DGU / Uređena zemlja',documentation:'https://geoportal.dgu.hr/cms/podaci-i-servisi/',status:'service_unavailable',reason:'Published anonymous WFS returned HTTP 404 on 2026-10-25; public UI success does not verify unattended access.'},
 FR:{name:'IGN API Carto — PCI',documentation:'https://apicarto.ign.fr/api/doc/cadastre',license:'Licence Ouverte; API retains source licence',status:'enabled'},
 NL:{name:'Kadaster / PDOK Kadastrale kaart',documentation:'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1?f=html&lang=en',license:'CC BY 4.0',status:'enabled'}
};
export function identityFor(row,body){
 const country=isoCountry(row.country),f=body.facts||{};
 if(!country||isoCountry(body.country)!==country)return {status:'country_unconfirmed',missing:['Confirmed property country consistent with original record']};
 // An agency's seat, portal host, listing ID, or approximate map point is never identity evidence.
 const i=f.registry_identity||f.registry_enrichment?.identity;
 if(!i)return {status:'missing_identity',missing:['Confirmed property country evidence','Full cadastral/property ID','Cadastral municipality/section and unit where applicable'],country};
 if(i.country_iso!==country)return {status:'identity_conflict',missing:['Resolve country mismatch; no lookup performed'],country};
 const evidence=f.registry_identity?.source_url||Object.values(f.registry_enrichment?.fields||{}).find(v=>v?.source_url)?.source_url;
 if(typeof evidence!=='string'||!/^https:\/\//.test(evidence))return {status:'country_unconfirmed',missing:['Documented source of the property identifier and country'],country};
 if(i.unit||i.units?.length>1)return {status:'unit_review_required',missing:['Verified relation of individual unit to parcel; parcel data is not unit data'],country};
 const id={...i,country_iso:country};
 if(country==='NL'&&i.issuer==='Kadaster'&&i.identifier_type==='cadastral_parcel'&&/^[A-Z]{3}\d{2}$/.test(i.municipality_code||'')&&/^[A-Z]{1,2}$/.test(i.section||'')&&/^\d{1,5}$/.test(i.parcel||''))return {status:'ready',country,identity:id};
 if(country==='FR'&&i.issuer==='DGFiP'&&i.identifier_type==='cadastral_parcel'&&/^\d{5}$/.test(i.municipality_code||'')&&/^\d{3}$/.test(i.prefix||'')&&/^\w{2}$/.test(i.section||'')&&/^\d{4}$/.test(i.parcel||''))return {status:'ready',country,identity:id};
 if(!SERVICES[country]||SERVICES[country].status!=='enabled')return {status:'adapter_required',country,identity:id,missing:[SERVICES[country]?.reason||'Verify official national service, licence and adapter before lookup']};
 return {status:'missing_identity',country,missing:['Complete issuer, identifier type, local municipality code, section/prefix, parcel and unit identity; preserve original zeroes']};
}
export function requestFor(i){
 if(i.country_iso==='NL')return 'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items?'+new URLSearchParams({akr_kadastrale_gemeente_code_waarde:i.municipality_code,sectie:i.section,perceelnummer:i.parcel,limit:'2',f:'json'});
 if(i.country_iso==='FR')return 'https://apicarto.ign.fr/api/cadastre/parcelle?'+new URLSearchParams({code_insee:i.municipality_code,com_abs:i.prefix,section:i.section,numero:i.parcel,_limit:'2',source_ign:'PCI'});
 throw Error('No enabled national adapter');
}
export function parseResult(identity,json,url,readAt){
 if(!Array.isArray(json?.features))throw Error('Invalid feature collection');
 // Never silently pick one result, even when the first happens to match.
 if(json.features.length!==1||json.numberMatched>1||json.totalFeatures>1||json.links?.some(x=>x.rel==='next'))return {status:json.features.length?'ambiguous':'not_found',fields:{},missing:['Unique official parcel match']};
 const feature=json.features[0],p=feature.properties||{},nl=identity.country_iso==='NL';
 const match=nl?p.akr_kadastrale_gemeente_code_waarde===identity.municipality_code&&p.sectie===identity.section&&String(p.perceelnummer)===String(Number(identity.parcel)):
 (p.code_insee||String(p.code_dep||'')+String(p.code_com||''))===identity.municipality_code&&p.com_abs===identity.prefix&&p.section===identity.section&&p.numero===identity.parcel;
 if(!match)return {status:'identity_conflict',fields:{},missing:['Official response does not match complete requested identity']};
 if(nl&&p.status_historie_waarde!=='Geldig')return {status:'historical_record',fields:{},missing:['Current valid official parcel record']};
 const service=SERVICES[identity.country_iso],provenance={source_name:service.name,source_url:url,documentation_url:service.documentation,attribution:service.name,license:service.license,identity,read_at:readAt,document_date:null,valid_from:p.begin_geldigheid||null};
 const field=(value,meaning)=>({value,meaning,...provenance});
 const fields={official_parcel_identity:field(identity,'Parcel identity only; not ownership, sale availability or legal clearance')};
 if(nl&&typeof p.kadastrale_grootte_waarde==='number'&&p.kadastrale_grootte_waarde>0)fields.cadastral_area_m2=field(p.kadastrale_grootte_waarde,'Recorded cadastral land area; not apartment or usable building area');
 if(nl&&p.kadastrale_gemeente_waarde)fields.cadastral_municipality_name=field(p.kadastrale_gemeente_waarde,'Official municipality name');
 if(feature.geometry)fields.parcel_geometry=field(feature.geometry,'Indicative cadastral parcel geometry; not survey precision or unit geometry');
 return {status:'matched',identity,fields,missing:['Ownership, encumbrances, planning/permits and sale availability require separate evidence']};
}
export async function enrich(row,body,fetcher=fetch){
 const assessment=identityFor(row,body),checkedAt=new Date().toISOString();
 if(assessment.status!=='ready')return {...assessment,version:VERSION,checked_at:checkedAt,fields:{},seller_email_sent:false};
 const url=requestFor(assessment.identity);
 try{
  const response=await fetcher(url,{headers:{Accept:'application/geo+json, application/json','User-Agent':'EUPropertyResearch/0.3'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {...assessment,status:'service_error',http_status:response.status,version:VERSION,checked_at:checkedAt,fields:{},missing:['Official service HTTP '+response.status+'; no bypass or alternate-country request']};
  const text=await response.text();if(text.length>2000000)throw Error('Official response exceeds 2 MB');
  return {...parseResult(assessment.identity,JSON.parse(text),url,new Date().toISOString()),version:VERSION,checked_at:checkedAt,seller_email_sent:false};
 }catch{return {status:'service_error',country:assessment.country,version:VERSION,checked_at:checkedAt,fields:{},missing:['Official API unavailable, timed out, redirected or returned invalid JSON; no bypass attempted']};}
}
export function mergeEnrichment(body,result){
 const copy=structuredClone(body);copy.facts??={};
 const prior=copy.facts.registry_enrichment||{},before=prior.automatic||{};
 const conflicts=[...(before.conflicts||[])],accepted={};
 for(const [key,value] of Object.entries(result.fields||{})){
  const old=before.fields?.[key]||prior.fields?.[key];
  if(old&&JSON.stringify(old.value)!==JSON.stringify(value.value))conflicts.push({field:key,previous:old,incoming:value,detected_at:result.checked_at});
  else accepted[key]=value;
 }
 // All source, reviewed and manually enriched facts remain unchanged. New observations have their own namespace.
 copy.facts.registry_enrichment={...prior,automatic:{...before,...result,status:conflicts.length?'conflict_review_required':result.status,fields:{...(before.fields||{}),...accepted},conflicts:conflicts.slice(-100),legal_clearance:false}};
 return copy;
}
export async function runCountry(sql,country){
 if(!Object.hasOwn(COUNTRIES,country))throw Error('Unsupported country');
 const key='enrichment:automatic:v1:'+country;
 const [saved]=await sql`select body_json from discovery_runs where source_id=${key}`;
 let state={};try{state=JSON.parse(saved?.body_json||'{}')}catch{}
 const cursor=typeof state.next_cursor==='string'?state.next_cursor:'';
 const rows=await sql`select id,country,body_json from source_candidates where kind='property' and country in (${country},${COUNTRIES[country]}) and id>${cursor} order by id limit 100`;
 const counts={},processed=[],writeConflicts=[],pending=[];
 let networkRequests=0;
 for(const row of rows){
  let body;try{body=JSON.parse(row.body_json)}catch{counts.invalid_json=(counts.invalid_json||0)+1;processed.push(row.id);continue;}
  const check=identityFor(row,body);
  const result=check.status==='ready'&&networkRequests>=2?{status:'deferred_request_budget',version:VERSION,checked_at:new Date().toISOString(),fields:{},missing:['Deferred to a later bounded pass']}:(await enrich(row,body));
  if(check.status==='ready'&&result.status!=='deferred_request_budget')networkRequests++;
  counts[result.status]=(counts[result.status]||0)+1;
  pending.push({row,body,result});processed.push(row.id);
 }
 // Lock and write one bounded batch, avoiding hundreds of database round trips.
 if(pending.length)await sql.begin(async tx=>{
  const locked=await tx`select id,country,body_json from source_candidates where id=any(${pending.map(p=>p.row.id)}::text[]) for update`;
  const current=new Map(locked.map(r=>[r.id,r])),updates=[];
  for(const item of pending){
   const prior=current.get(item.row.id);
   if(!prior||prior.body_json!==item.row.body_json||prior.country!==item.row.country){writeConflicts.push(item.row.id);continue;}
   updates.push({id:item.row.id,expected:prior.body_json,body_json:JSON.stringify(mergeEnrichment(item.body,item.result)),stamp:item.result.checked_at});
  }
  if(updates.length){
   await tx`update source_candidates c set body_json=v.body_json from unnest(${updates.map(u=>u.id)}::text[],${updates.map(u=>u.body_json)}::text[],${updates.map(u=>u.expected)}::text[]) as v(id,body_json,expected) where c.id=v.id and c.body_json=v.expected`;
   const verified=await tx`select id,body_json from source_candidates where id=any(${updates.map(u=>u.id)}::text[])`;
   const wanted=new Map(updates.map(u=>[u.id,u]));
   if(verified.length!==updates.length)throw Error('Enrichment batch verification count mismatch');
   for(const v of verified)if(JSON.parse(v.body_json).facts.registry_enrichment.automatic.checked_at!==wanted.get(v.id).stamp)throw Error('Enrichment write verification failed: '+v.id);
  }
 });
 // Standalone properties have no source_candidate body for supplementary evidence.
 // Record their exact gap in a separate checkpoint without fabricating candidates.
 const standalone=await sql`select p.id,p.country,p.source from properties p where p.country in (${country},${COUNTRIES[country]}) and not exists(select 1 from source_candidates c where c.property_id=p.id) order by p.id limit 100`;
 for(const p of standalone){
  const gap={version:VERSION,property_id:String(p.id),country,source_url:p.source,status:'missing_identity_and_storage_adapter',checked_at:new Date().toISOString(),missing:['Confirmed property identifier from original documentation','Supplementary evidence adapter for standalone property record'],seller_email_sent:false};
  await sql`insert into discovery_runs(source_id,status,checked_at,body_json) values(${'enrichment:property:v1:'+p.id},${'Nedostaje identifikator i veza za dopunu'},${gap.checked_at},${JSON.stringify(gap)}) on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json`;
 }
 const complete=rows.length<100,stamp=new Date().toISOString();
 const checkpoint={version:VERSION,country,standalone_property_ids:standalone.map(p=>String(p.id)),checked_at:stamp,next_cursor:complete?'':rows.at(-1).id,completed_cycles:(state.completed_cycles||0)+(complete?1:0),processed_ids:processed,counts,write_conflicts:writeConflicts,network_requests:networkRequests,scope:'existing property candidates only; no listing import',service:SERVICES[country]||{status:'adapter_required'},standalone_properties:'Separate original properties without source_candidates need an evidence storage adapter; never silently excluded from scope'};
 await sql`insert into discovery_runs(source_id,status,checked_at,body_json) values(${key},${counts.matched?'Dopunjeno':'Provjereni preduvjeti; otvoreni nedostaci'},${stamp},${JSON.stringify(checkpoint)}) on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json where discovery_runs.body_json=${saved?.body_json||''}`;
 return {country,processed:processed.length,counts,next_cursor:checkpoint.next_cursor,cycle_complete:complete,write_conflicts:writeConflicts.length};
}

