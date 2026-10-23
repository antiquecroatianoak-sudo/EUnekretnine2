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
// Stored pairs from the separate `pairs` read (complete: every linked record was fetched by id) or from the full
// read (records may be outside its row caps). Pairs whose property or buyer is outside the visible lists, missing,
// or whose stored result is malformed stay out of the list but are counted with a reason; none is silently lost.
const validResult=r=>[MATCH,CANDIDATE,REJECT].includes(r.status)&&Number.isFinite(r.score)&&['reasons','missing','rejected'].every(k=>Array.isArray(r[k]));
export function pairsView(resp,{complete=true}={}){
 if(!resp)return {matches:[],hidden:[]};
 const visible=rows=>(rows||[]).filter(r=>r.visible!==false);
 const matches=storedMatches({properties:visible(resp.properties),investors:visible(resp.investors),match_results:resp.match_results});
 const p=new Map((resp.properties||[]).map(r=>[String(r.id),r])),i=new Map((resp.investors||[]).map(r=>[String(r.id),r]));
 const absent=complete?'više ne postoji':'nije u učitanim podacima';
 const hidden=(resp.match_results||[]).flatMap(m=>{
  const prop=p.get(String(m.property_id)),inv=i.get(String(m.investor_id));
  const reason=!validResult(jsonObject(m.result_json))?'spremljeni rezultat nema valjanu strukturu':!prop?'nekretnina '+absent:!inv?'kupac '+absent:prop.visible===false?'nekretnina je istekla ili uklonjena iz izvora':inv.visible===false?'zahtjev kupca je istekao ili uklonjen iz izvora':null;
  return reason?[{property_id:m.property_id,investor_id:m.investor_id,reason}]:[];
 });
 return {matches,hidden,totals:resp.totals||null,loaded_at:resp.loaded_at};
}
// Why the possible-pairs list is empty or short. A failed load is never presented as zero.
export function pairsExplanation({error=null,matches=[],hidden=[],totals=null,filtered=0}={}){
 if(error&&!matches.length)return {kind:'error',text:'Mogući parovi nisu učitani ('+error+'). Ovo nije stvarna nula; pokušaj ponovno.'};
 const candidates=matches.filter(m=>m.status===CANDIDATE).length;
 const byReason=hidden.reduce((o,h)=>({...o,[h.reason]:(o[h.reason]||0)+1}),{});
 const hiddenText=Object.entries(byReason).map(([r,n])=>n+' skriveno jer '+r).join('; ');
 if(!matches.length&&!hidden.length)return {kind:'zero',text:'U bazi trenutačno nema spremljenih rezultata uparivanja'+(totals?' (u bazi '+totals.properties+' nekretnina i '+totals.investors+' kupaca)':'')+'. Pokreni „Izračunaj ponovno” ili „Zašto nema više parova?” za razloge isključenja.'};
 if(!candidates)return {kind:'zero',text:'Nema mogućih parova za provjeru: spremljeno je '+matches.length+' rezultata, ali nijedan nije kandidat'+(hiddenText?'; '+hiddenText:'')+'.'};
 if(filtered===0)return {kind:'filtered',text:'Nema rezultata za odabrane filtre; ukupno je '+candidates+' mogućih parova. Očisti filtre.'};
 return hiddenText?{kind:'hidden',text:hiddenText+'.'}:null;
}
// Labels for the counts-only diagnostics funnel.
export function funnelRows(f){
 if(!f)return [];
 const rows=[['Nekretnine u izračunu',f.properties],['Kupci u izračunu',f.investors],['Svi mogući parovi (nekretnina × kupac)',f.pairs],['Država izvan interesa kupca',f.country_mismatch]];
 for(const [k,v] of Object.entries(f.excluded||{}).sort((a,b)=>b[1]-a[1]))rows.push(['Isključeno: '+k,v]);
 for(const [k,v] of Object.entries(f.suggested||{}))rows.push(['Spremljeno: '+k,v]);
 rows.push(['Nekretnine bez prepoznate vrste',f.properties_without_type],['Nekretnine bez URL-a izvora',f.properties_without_source],['Kupci bez navedene vrste',f.investors_without_types],['Kupci bez URL-a izvora',f.investors_without_source]);
 return rows;
}
