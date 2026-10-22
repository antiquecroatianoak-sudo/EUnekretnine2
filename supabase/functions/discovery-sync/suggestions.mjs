import {evaluate,criteria,country,norm,validUrl,num,TYPES,REJECT,checkValid,sourceConditions,pairText,gap,settle,SOURCE_CONDITIONS} from './domain.mjs';

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
 const result=evaluate({...p,property_type:ptype},{...i,preferred_countries:countries,criteria_json:c},now,pairChecks);
 if(result.status===REJECT)return null;
 // A known budget is informative only (evaluate notes it); an unknown or undisclosed one never drops a pair.
 const legacy=originalTypes.some((v,n)=>v!==mapped[n]);
 // A dated check with evidence confirms the original wording until it changes. Whether this
 // property meets those conditions is a separate, pair-specific check bound to its facts.
 const sourceChecked=checkValid(raw.source_conditions_check,sourceConditions(raw),now);
 const applies=[legacy||mapped.some(v=>!v),raw.preferred_locations?.length||raw.locations?.length,raw.required_criteria?.length||raw.required?.property_type];
 for(const [n,[wording,fulfilment]] of SOURCE_CONDITIONS.entries()){
  if(!applies[n])continue;
  if(!sourceChecked)gap(result,wording,'buyer');
  else if(!checkValid(pairChecks[fulfilment],pairText(sourceConditions(raw),p),now))gap(result,fulfilment,'pair');
 }
 const stamp=Date.parse(p.source_checked_on||'');
 if(!Number.isFinite(stamp)||stamp>now||now-stamp>30*86400000)gap(result,'Aktualnost izvora nekretnine nije potvrđena unutar 30 dana','property');
 if(!['Aktivno','Provjereno','Novo - aktivna dražba'].includes(p.status))gap(result,'Potrebna potvrda aktivnosti oglasa','property');
 if(p.auction_at&&Date.parse(p.auction_at)<now)return null;
 settle(result);
 return result;
}
