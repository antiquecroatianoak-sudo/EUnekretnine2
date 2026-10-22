import {COUNTRIES} from './domain.mjs';
import {assessEvidence} from './verification.mjs';
// Merge a fetched candidate into the stored record. Review fields, first_seen and
// earlier evidence are kept; a field missing from the new fetch is reported, not erased.
export function mergeCandidate(existing,row,source,now=Date.now()){
 let prior={};try{prior=JSON.parse(existing?.body_json||'{}')}catch{}
 const merged={...prior,...row,id:existing?.id||row.id,source_id:existing?.source_id||row.source_id,country:COUNTRIES[source.country]||({'France':'Francuska'}[source.country])||source.country,first_seen:prior.first_seen||row.first_seen,status:prior.status||'Za provjeru',verified:prior.verified===true};
 // Retain user review fields and prior suggestions. Source evidence is refreshed separately.
 if(prior.match_suggestions)merged.match_suggestions=prior.match_suggestions;
 merged.facts={...(prior.facts||{})};
 const notObserved=[];
 for(const [key,value] of Object.entries(row.facts)){
  if(value==null&&merged.facts[key]!=null)notObserved.push(key);
  else merged.facts[key]=value;
 }
 merged.facts.not_observed_in_latest_fetch=notObserved;
 // Never interpret an import timestamp or a reachable page as confirmed interest/availability.
 merged.verification=assessEvidence(merged,now);
 merged.facts.verification_note=merged.verification.classification+'; aktualnost, identitet i pravno stanje nisu potvrđeni samim uvozom.';
 return merged;
}
