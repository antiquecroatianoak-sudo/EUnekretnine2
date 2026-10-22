import {evaluate,criteria,country,norm,validUrl,num,TYPES,CANDIDATE,REJECT} from './domain.mjs';

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

export function suggestion(p,i,now=Date.now()){
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
 const result=evaluate({...p,property_type:ptype},{...i,preferred_countries:countries,criteria_json:c},now);
 if(result.status===REJECT)return null;
 if(num(i.max_budget)&&num(p.price)&&p.price>i.max_budget)return null;
 if(result.total_cost!==null&&num(i.max_budget)&&result.total_cost>i.max_budget)return null;
 const legacy=originalTypes.some((v,n)=>v!==mapped[n]);
 if(legacy||mapped.some(v=>!v))result.missing.push('Provjera izvornog opisa vrste i namjene nekretnine');
 if(raw.preferred_locations?.length||raw.locations?.length)result.missing.push('Provjera izvornih lokacijskih uvjeta kupca');
 if(raw.required_criteria?.length||raw.required?.property_type)result.missing.push('Provjera dodatnih izvornih uvjeta kupca');
 const stamp=Date.parse(p.source_checked_on||'');
 if(!Number.isFinite(stamp)||stamp>now||now-stamp>30*86400000)result.missing.push('Aktualnost izvora nekretnine nije potvrđena unutar 30 dana');
 if(!['Aktivno','Provjereno','Novo - aktivna dražba'].includes(p.status))result.missing.push('Potrebna potvrda aktivnosti oglasa');
 if(p.auction_at&&Date.parse(p.auction_at)<now)return null;
 result.missing=[...new Set(result.missing)];
 if(result.missing.length)result.status=CANDIDATE;
 return result;
}
