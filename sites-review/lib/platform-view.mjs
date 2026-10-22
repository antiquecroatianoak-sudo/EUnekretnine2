import {MATCH,CANDIDATE,REJECT,country} from './domain.mjs';
// Possible pairs are stored candidates only; they are never shown as confirmed matches.
export const possiblePairs=matches=>matches.filter(m=>m.status===CANDIDATE);
// The "Mogući parovi" entry point: earlier filters must not hide any candidate.
export const possiblePairsFilters=()=>({tab:'Podudaranja',matchStatus:CANDIDATE,query:'',filterCountry:'Sve države',page:1});
export function filterMatches(matches,{query='',filterCountry='Sve države',matchStatus='Svi rezultati'}={}){
 const search=v=>JSON.stringify(v).toLocaleLowerCase('hr').includes(query.toLocaleLowerCase('hr'));
 return matches.filter(m=>search([m.property.title,m.property.city,m.property.region,country(m.property.country),m.investor.name])&&(filterCountry==='Sve države'||country(m.property.country)===filterCountry)&&(matchStatus==='Svi rezultati'||m.status===matchStatus));
}
export function jsonObject(value){
 try {const parsed=typeof value==='string'?JSON.parse(value):value;return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return {}}
}
export function pageWindow(rows,page,size=30){
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(pages,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
 return {rows:rows.slice((current-1)*size,current*size),page:current,pages};
}
export function storedMatches(data){
 const properties=new Map((data.properties||[]).map(p=>[String(p.id),p]));
 const investors=new Map((data.investors||[]).map(i=>[String(i.id),i]));
 return (data.match_results||[]).flatMap(row=>{
  const property=properties.get(String(row.property_id)),investor=investors.get(String(row.investor_id)),result=jsonObject(row.result_json);
  if(!property||!investor||![MATCH,CANDIDATE,REJECT].includes(result.status)||!Number.isFinite(result.score)||!['reasons','missing','rejected'].every(k=>Array.isArray(result[k])))return [];
  return [{...result,property,investor,updated:row.updated}];
 }).sort((a,b)=>[MATCH,CANDIDATE,REJECT].indexOf(a.status)-[MATCH,CANDIDATE,REJECT].indexOf(b.status)||b.score-a.score||String(a.property.id).localeCompare(String(b.property.id))||String(a.investor.id).localeCompare(String(b.investor.id)));
}
export function sourceDescription(row){
 if(row.kind!=='buyer')return 'Nekretnina / objava prodaje';
 const body=jsonObject(row.body_json),facts=body.facts||{};
 return facts.transaction_type==='buy_request'?'Objava potražnje – za provjeru':'Potencijalni kupac ili zastupnik – interes nepotvrđen';
}
export function sourceProgress(run){
 const state=jsonObject(run.body_json),pending=Array.isArray(state.pending)?state.pending.length:0;
 const counts=[];
 for(const [key,label] of [['pages_processed','obrađenih stranica'],['inserted_count','novih'],['updated_count','ažuriranih']])if(Number.isFinite(state[key]))counts.push(`${state[key]} ${label}`);
 if(pending)counts.push(`${pending} poveznica čeka nastavak`);
 return {state,summary:counts.join(' · '),continuing:run.status==='Djelomično'&&pending>0&&!state.error};
}
