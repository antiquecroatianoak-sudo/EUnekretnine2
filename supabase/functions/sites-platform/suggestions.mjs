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

export function suggestion(p,i,now=Date.now(),pairChecks={}){
 const raw=criteria(i),notes=object(i.notes);if(raw._invalid)return null;
 const c={...raw,source_url:raw.source_url||raw.evidence_url||notes.official_url,
  checked_at:raw.checked_at||notes.checked_at};
 if(!validUrl(c.source_url)||!validUrl(p.source))return null;
 const originalTypes=raw.property_types||[];
 if(!Array.isArray(originalTypes)||!originalTypes.length)return null;
 const mapped=originalTypes.map(type),mappedTypes=[...new Set(mapped.filter(Boolean))];
 const ptype=type(p.property_type);
 if(!ptype||!mappedTypes.includes(ptype))return null;
 c.property_types=mappedTypes;
 for(const [target,old] of [['min_area','min_area_m2'],['max_area','max_area_m2']])
  if(c[target]==null&&num(raw[old]))c[target]=raw[old];
 const countries=String(i.preferred_countries||'').trim()||
  (Array.isArray(raw.preferred_countries)?raw.preferred_countries.join(','):'');
 if(!countries||!countries.split(',').map(v=>norm(country(v))).includes(norm(country(p.country))))return null;
 const result=evaluate({...p,property_type:ptype},{...i,preferred_countries:countries,criteria_json:c},now,pairChecks,raw);
 if(result.status===REJECT)return null;
 // A known budget is informative only (evaluate notes it); an unknown or undisclosed one never drops a pair.
 // Source freshness, active status and city are checked in evaluate(), like property_eligible.
 // investor_eligible reads the stored row, not the compatibility view built above.
 if(!storedBuyerEligible(i,raw,now))gap(result,BUYER_RECORD,'buyer');
 if(p.auction_at&&Date.parse(p.auction_at)<now)return null;
 settle(result);
 return result.status===REJECT?null:result;
}
