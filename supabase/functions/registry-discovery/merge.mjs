import {COUNTRIES} from './domain.mjs';
import {assessEvidence} from './verification.mjs';
const CLOSURE_KEYS=['source_listing_state','source_status_evidence','call_currency','availability'];
const PROPERTY_COUNTRY_HOSTS=new Set(['immonestor.at','adamant-immobilien.at','immolution.at','raiffeisen-immobilien.at','zweitwohnsitze.com']);
export function candidateCountry(row,source){
 const host=new URL(source.url).hostname.replace(/^www\./,'');
 if(row.kind==='property'&&PROPERTY_COUNTRY_HOSTS.has(host)){
  if(!Object.hasOwn(COUNTRIES,row.country))throw Error('Missing supported property country');
  return COUNTRIES[row.country];
 }
 // Unknown buyer seat remains unknown. The storage column is NOT NULL and
 // legacy research candidates represent unknown with an empty string; demand
 // geography remains independently documented in facts.preferred_countries.
 if(row.kind==='buyer'&&!source.country)return '';
 return COUNTRIES[source.country]||({'France':'Francuska'}[source.country])||source.country;
}
// Same rule as public_land_sources.reopens: only an explicit active state with a
// future deadline is new evidence that a closed call reopened.
export function reopens(facts,now=Date.now()){
 const d=String(facts.deadline||''),end=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d)?d+'T23:59:59Z':d);
 return facts.source_listing_state==='active'&&!!facts.reopen_evidence&&Number.isFinite(end)&&end>=now;
}
// Merge a fetched candidate into the stored record. Review fields, first_seen and
// earlier evidence are kept; a field missing from the new fetch is reported, not erased.
export function mergeCandidate(existing,row,source,now=Date.now()){
 let prior={};try{prior=JSON.parse(existing?.body_json||'{}')}catch{}
 const merged={...prior,...row,id:existing?.id||row.id,source_id:existing?.source_id||row.source_id,country:candidateCountry(row,source),first_seen:prior.first_seen||row.first_seen,status:prior.status||'Za provjeru',verified:prior.verified===true};
 // Retain user review fields and prior suggestions. Source evidence is refreshed separately.
 if(prior.match_suggestions)merged.match_suggestions=prior.match_suggestions;
 merged.facts={...(prior.facts||{})};
 const notObserved=[];
 for(const [key,value] of Object.entries(row.facts)){
  if(value==null&&merged.facts[key]!=null)notObserved.push(key);
  else merged.facts[key]=value;
 }
 merged.facts.not_observed_in_latest_fetch=notObserved;
 // A closed call stays closed until a fetch brings new evidence; missing data is not reopening.
 const before=prior.facts||{};
 if(['expired','removed'].includes(before.source_listing_state)&&!reopens(row.facts,now)){
  for(const key of CLOSURE_KEYS)if(key in before)merged.facts[key]=before[key];
  // Older closed records predate these labels; the new fetch must not describe them as unknown.
  merged.facts.call_currency=before.call_currency||'Poziv zatvoren ili istekao';
  merged.facts.availability=before.availability||'Poziv je zatvoren ili mu je objavljeni rok istekao; nije aktivna potražnja.';
 }
 // Never interpret an import timestamp or a reachable page as confirmed interest/availability.
 merged.verification=assessEvidence(merged,now);
 merged.facts.verification_note=merged.verification.classification+'; aktualnost, identitet i pravno stanje nisu potvrđeni samim uvozom.';
 return merged;
}



