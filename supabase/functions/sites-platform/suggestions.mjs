import {evaluate,criteria,country,norm,validUrl,num,TYPES,REJECT,checkValid,sourceConditions,pairText,gap,settle,SOURCE_CONDITIONS,checkCondition,storedBuyerEligible,BUYER_RECORD} from './domain.mjs';

// Compatibility only: retain every original criterion and never invent budgets.
const aliases=new Map([
 ['zemljište','Zemljište'],['zemljišta','Zemljište'],['građevinsko zemljište','Zemljište'],
 ['land_for_real_estate_development','Zemljište'],['residential_development_land','Zemljište'],
 ['commercial_development_land','Zemljište'],['mixed_use_development_land','Zemljište'],
 ['urban_land','Zemljište'],['developable_land','Zemljište'],['development_land','Zemljište'],
 ['vacant_development_land','Zemljište'],['built_land_with_development_potential','Zemljište'],
 ['infill_housing_sites','Zemljište'],['land_positions_for_housing','Zemljište'],
 ['vacant_or_obsolete_buildings','Zgrada'],['real_estate_ensembles_for_restructuring','Zgrada'],
 ['obsolete_industrial_or_commercial_buildings','Poslovni prostor'],
 ['Stambena zgrada','Zgrada'],['Stambeno-poslovna zgrada','Zgrada'],['Mješovita stambeno-poslovna zgrada','Zgrada'],
 ['kuća','Kuća'],['stan','Stan'],['zgrada','Zgrada'],['poslovni prostor','Poslovni prostor']
].map(([k,v])=>[norm(k),v]));
const type=v=>TYPES.includes(v)?v:aliases.get(norm(v));
const object=v=>{try{const o=JSON.parse(v);return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}};

// Exit reasons of suggestion(), reported by pairFunnel() to separate justified exclusions from data loss.
export const EXCLUDED={BUYER_CRITERIA:'Kriteriji kupca nisu valjan JSON objekt',BUYER_SOURCE:'Kupac nema URL izvora zahtjeva',PROPERTY_SOURCE:'Nekretnina nema valjan URL izvora',
 BUYER_TYPES:'Kupac nema navedenu vrstu nekretnine',PROPERTY_TYPE:'Vrsta nekretnine nije poznata ni prepoznata',TYPE:'Vrsta nekretnine nije među traženima',COUNTRY:'Država nije među državama interesa kupca',AUCTION:'Dražba je prošla'};
// `why`, when given, receives the reason a pair was not suggested (EXCLUDED values or 'Ne odgovara: <kriterij>').
export function suggestion(p,i,now=Date.now(),pairChecks={},why=null){
 const out=reason=>{if(why)why.reason=reason;return null};
 const raw=criteria(i),notes=object(i.notes);if(raw._invalid)return out(EXCLUDED.BUYER_CRITERIA);
 const c={...raw,source_url:raw.source_url||raw.evidence_url||notes.official_url,
  checked_at:raw.checked_at||notes.checked_at};
 if(!validUrl(c.source_url))return out(EXCLUDED.BUYER_SOURCE);
 if(!validUrl(p.source))return out(EXCLUDED.PROPERTY_SOURCE);
 const originalTypes=raw.property_types||[];
 if(!Array.isArray(originalTypes)||!originalTypes.length)return out(EXCLUDED.BUYER_TYPES);
 const mapped=originalTypes.map(type),mappedTypes=[...new Set(mapped.filter(Boolean))];
 const ptype=type(p.property_type);
 if(!ptype)return out(EXCLUDED.PROPERTY_TYPE);
 if(!mappedTypes.includes(ptype))return out(EXCLUDED.TYPE);
 c.property_types=mappedTypes;
 for(const [target,old] of [['min_area','min_area_m2'],['max_area','max_area_m2']])
  if(c[target]==null&&num(raw[old]))c[target]=raw[old];
 const countries=String(i.preferred_countries||'').trim()||
  (Array.isArray(raw.preferred_countries)?raw.preferred_countries.join(','):'');
 if(!countries||!countries.split(',').map(v=>norm(country(v))).includes(norm(country(p.country))))return out(EXCLUDED.COUNTRY);
 const result=evaluate({...p,property_type:ptype},{...i,preferred_countries:countries,criteria_json:c},now,pairChecks,raw);
 if(result.status===REJECT)return out('Ne odgovara: '+result.rejected[0]);
 // A known budget is informative only (evaluate notes it); an unknown or undisclosed one never drops a pair.
 // Source freshness, active status and city are checked in evaluate(), like property_eligible.
 // investor_eligible reads the stored row, not the compatibility view built above.
 if(!storedBuyerEligible(i,raw,now))gap(result,BUYER_RECORD,'buyer');
 if(p.auction_at&&Date.parse(p.auction_at)<now)return out(EXCLUDED.AUCTION);
 settle(result);
 return result.status===REJECT?out('Ne odgovara: '+result.rejected[0]):result;
}

// Counts only (no records): how many property × buyer pairs exist, how many are suggested and why the rest are not.
// Uses the same country preselection as refreshSuggestions(); pairs outside a buyer's countries are counted, not evaluated.
export function pairFunnel(props,investors,now=Date.now(),checks=new Map()){
 const f={properties:props.length,investors:investors.length,pairs:props.length*investors.length,country_mismatch:0,suggested:{},excluded:{},properties_without_type:0,properties_without_source:0,investors_without_types:0,investors_without_source:0};
 const byCountry=new Map();
 for(const i of investors){
  const c=criteria(i),countries=String(i.preferred_countries||'').trim()||(Array.isArray(c.preferred_countries)?c.preferred_countries.join(','):'');
  if(!(Array.isArray(c.property_types)&&c.property_types.length))f.investors_without_types++;
  if(!validUrl(c.source_url||c.evidence_url||object(i.notes).official_url))f.investors_without_source++;
  for(const key of new Set(countries.split(',').map(v=>norm(country(v))).filter(Boolean))){if(!byCountry.has(key))byCountry.set(key,[]);byCountry.get(key).push(i)}
 }
 const add=(o,k)=>{o[k]=(o[k]||0)+1};
 for(const p of props){
  if(!type(p.property_type))f.properties_without_type++;
  if(!validUrl(p.source))f.properties_without_source++;
  const list=byCountry.get(norm(country(p.country)))||[];f.country_mismatch+=investors.length-list.length;
  for(const i of list){const why={},r=suggestion(p,i,now,checks.get(p.id+'-'+i.id),why);if(r)add(f.suggested,r.status);else add(f.excluded,why.reason)}
 }
 return f;
}
