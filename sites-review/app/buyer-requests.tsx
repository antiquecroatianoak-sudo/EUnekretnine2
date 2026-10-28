// @ts-nocheck
'use client';
import {useState,useEffect} from 'react';
import {criteria,TYPES,CONDITIONS,COUNTRIES,country} from '@/lib/domain.mjs';
import {workflowCall} from './offer-workflow';
import {RequirementsEditor} from './facts-editor';
import {parseRequestText,PARSER_VERSION} from '@/lib/request-parser.mjs';
// One buyer, several independent documented requests. Each request keeps its own criteria, source and date;
// the original profile is shown read-only and is never rewritten from here.
const empty={label:'',preferred_countries:'',property_types:[],conditions:[],min_area:'',max_area:'',cities:'',regions:'',source_url:'',checked_at:'',notes:'',min_budget:'',max_budget:'',verified:false,requirements:[]};
const list=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const area=v=>v===''||v==null?null:Number(v);
export function requestBody(form){
 const c={property_types:form.property_types,conditions:form.conditions,min_area:area(form.min_area),max_area:area(form.max_area),cities:list(form.cities),regions:list(form.regions),source_url:form.source_url.trim()||null,requirements:form.requirements};
 if(form.checked_at)c.checked_at=new Date(form.checked_at+'T00:00:00Z').toISOString();
 return {label:form.label,preferred_countries:form.preferred_countries,notes:form.notes,verified:form.verified,...(form.source_text?{source_text:form.source_text,parsed_by:form.parsed_by||PARSER_VERSION}:{}),
  min_budget:form.min_budget===''?null:Number(form.min_budget),max_budget:form.max_budget===''?null:Number(form.max_budget),criteria:c};
}
function fromRow(r){const c=criteria(r);return {...empty,id:r.id,label:c.request_label||'',preferred_countries:r.preferred_countries||'',property_types:c.property_types||[],conditions:c.conditions||[],
 min_area:c.min_area??'',max_area:c.max_area??'',cities:(c.cities||[]).join(', '),regions:(c.regions||[]).join(', '),source_url:c.source_url||'',checked_at:c.checked_at?String(c.checked_at).slice(0,10):'',notes:r.notes||'',
 min_budget:r.min_budget??'',max_budget:r.max_budget??'',verified:!!r.verified,requirements:Array.isArray(c.requirements)?c.requirements:[]}}
const FIELD_LABEL={property_types:'Vrste',conditions:'Stanja',min_area:'Površina od (m²)',max_area:'Površina do (m²)',area_basis:'Osnova površine',preferred_countries:'Države potražnje',seat_country:'Sjedište (nije potražnja)',min_budget:'Budžet od € (informativno)',max_budget:'Budžet do € (informativno)',requirements:'Dodatni uvjeti'};
const showValue=(k,v)=>k==='requirements'?v.map(q=>q.key+' '+q.op+' '+(Array.isArray(q.value)?q.value.join(' / '):String(q.value))+(q.unit?' '+q.unit:'')+(q.mandatory?' (obavezno)':' (želja)')).join('; '):Array.isArray(v)?v.join(', '):String(v);
// A plain-text request becomes a proposal only: every value shows its source quote and confidence; the operator applies
// it to the form, corrects it and saves it. Nothing is verified and no contact is set.
function TextProposal({onApply}){
 const [text,setText]=useState(''),[parsed,setParsed]=useState(null),[err,setErr]=useState('');
 function propose(){setErr('');try{setParsed(parseRequestText(text))}catch(e){setErr(e.message);setParsed(null)}}
 return <details className='text-proposal'><summary>Prijedlog iz teksta zahtjeva (lokalni parser, bez slanja podataka)</summary>
  <label className='field'><span>Izvorni tekst zahtjeva</span><textarea rows={5} value={text} onChange={e=>setText(e.target.value)}/></label>
  <button className='secondary' type='button' onClick={propose} disabled={!text.trim()}>Predloži iz teksta</button>
  <p className='muted'>Ograničeni parser ({PARSER_VERSION}) prepoznaje vrste, stanja, države, površine, budžet i dio specijaliziranih uvjeta. Ne razumije sve; sve prijedloge provjeri.</p>
  {err&&<p className='error'>{err}</p>}
  {parsed?.notes?.map(n=><p className='notice' key={n}>{n}</p>)}
  {parsed&&!parsed.requests.length&&<p className='muted'>Nema teksta za obradu.</p>}
  {parsed?.requests.map(r=><section key={r.index} className='proposal'><h5>Prijedlog {r.index}</h5>
   {Object.keys(r.fields).length?<div className='table-scroll'><table><thead><tr><th>Polje</th><th>Prijedlog</th><th>Izvorni navod</th><th>Pouzdanost</th></tr></thead><tbody>
    {Object.entries(r.fields).map(([k,v])=><tr key={k}><td>{FIELD_LABEL[k]||k}</td><td>{showValue(k,v)}</td><td><small>„{r.evidence[k]}”</small></td><td>{r.confidence[k]}</td></tr>)}</tbody></table></div>:<p className='muted'>Ništa nije prepoznato.</p>}
   {r.ambiguities.length>0&&<div className='notice'><b>Za provjeru:</b><ul>{r.ambiguities.map(a=><li key={a}>{a}</li>)}</ul></div>}
   {r.unsupported.length>0&&<p className='muted'>Neprepoznato: {r.unsupported.map(u=>'„'+u+'”').join(' ')}</p>}
   <button className='primary' type='button' disabled={!Object.keys(r.fields).length} onClick={()=>onApply(r,parsed)}>Primijeni u obrazac (ne sprema)</button></section>)}
 </details>;
}
function Multi({label,values,value,onChange}){return <fieldset className='field'><legend>{label}</legend><div className='chips'>{values.map(v=><label key={v} className='checkbox'><input type='checkbox' checked={value.includes(v)} onChange={e=>onChange(e.target.checked?[...value,v]:value.filter(x=>x!==v))}/>{v}</label>)}</div></fieldset>}
function Text({label,value,onChange,type='text',hint}){return <label className='field'><span>{label}</span><input type={type} value={value??''} onChange={e=>onChange(e.target.value)}/>{hint&&<small className='muted'>{hint}</small>}</label>}
export function BuyerRequests({investorId,onChanged}){
 const [d,setD]=useState(null),[err,setErr]=useState(''),[form,setForm]=useState(null),[busy,setBusy]=useState(false);
 async function load(){try{const x=await workflowCall({action:'buyer_requests',investor_id:Number(investorId)});if(!Array.isArray(x?.items))throw Error('Zahtjevi kupca nisu učitani: neočekivan odgovor poslužitelja.');setD(x);setErr('')}catch(e){setD(null);setErr(e.message)}}
 useEffect(()=>{load()},[investorId]);
 const set=(k,v)=>setForm(f=>({...f,[k]:v}));
 async function save(){setBusy(true);setErr('');try{await workflowCall({action:'save_request',investor_id:Number(investorId),request_id:form.id??null,...requestBody(form)});setForm(null);await load();onChanged?.()}catch(e){setErr(e.message)}finally{setBusy(false)}}
 if(!d)return <div className='form-body'>{err?<div className='error'>{err}</div>:<p className='muted'>Učitavanje zahtjeva kupca…</p>}</div>;
 const profile=d.items.find(r=>r.root),requests=d.items.filter(r=>!r.root);
 return <div className='form-body buyer-requests'>
  <p><b>{profile?.name}</b> · sjedište {country(profile?.country)} (sjedište nije potražnja) · {requests.length} zasebnih zahtjeva uz izvorni profil</p>
  <p className='muted'>Svaki zahtjev ima vlastite kriterije, izvor i datum provjere i uparuje se zasebno. Kriteriji se ne spajaju, a kontakt i potvrda izvora ne prenose se na drugi zahtjev. Budžet je informativan i nije obavezan.</p>
  {err&&<div className='error' role='alert'>{err}</div>}
  <div className='request-list'>{d.items.map(r=>{const c=criteria(r);return <article key={r.id} className={'request-card'+(r.visible===false?' inactive':'')}>
   <div><small>{r.root?'IZVORNI PROFIL (ne mijenja se ovdje)':'ZAHTJEV'}</small><h4>{r.request_label}</h4></div>
   <p>{(c.property_types||[]).join(', ')||'Vrsta nije navedena'} · {(c.conditions||[]).join(', ')||'Stanje nije navedeno'}</p>
   <p>Države: {list(r.preferred_countries).map(country).join(', ')||'nisu navedene'}{c.min_area!=null||c.max_area!=null?' · površina '+(c.min_area??'?')+' – '+(c.max_area??'?')+' m²':''}</p>
   <p className='muted'>{r.verified?'Zahtjev označen potvrđenim':'Zahtjev za provjeru'}{c.checked_at?' · provjeren '+String(c.checked_at).slice(0,10):' · datum provjere nije upisan'}{r.visible===false?' · istekao u izvoru':''}</p>
   {!r.root&&<button className='text-button' type='button' onClick={()=>setForm(fromRow(r))}>Uredi zahtjev</button>}
  </article>})}</div>
  {!form&&<button className='primary' type='button' onClick={()=>setForm({...empty})}>Dodaj zaseban zahtjev</button>}
  {form&&<section className='offer-form'><h4>{form.id?'Uredi zahtjev':'Novi zaseban zahtjev'}</h4>
   <TextProposal onApply={r=>{const f=r.fields;setForm(x=>({...x,label:x.label||'Zahtjev iz teksta '+r.index,
    ...(f.property_types?{property_types:f.property_types}:{}),...(f.conditions?{conditions:f.conditions}:{}),...(f.min_area!=null?{min_area:String(f.min_area)}:{}),...(f.max_area!=null?{max_area:String(f.max_area)}:{}),
    ...(f.preferred_countries?{preferred_countries:f.preferred_countries.join(', ')}:{}),...(f.min_budget!=null?{min_budget:String(f.min_budget)}:{}),...(f.max_budget!=null?{max_budget:String(f.max_budget)}:{}),
    ...(f.requirements?{requirements:f.requirements}:{}),verified:false,source_text:r.block,parsed_by:PARSER_VERSION}))}}/>
   {form.source_text&&<p className='muted'>Obrazac je popunjen iz teksta; izvorni tekst sprema se interno uz zahtjev. Provjeri sva polja i dodaj izvor zahtjeva prije spremanja.</p>}
   <Text label='Naziv zahtjeva' value={form.label} onChange={v=>set('label',v)}/>
   <Text label='Države interesa (zarezom)' value={form.preferred_countries} onChange={v=>set('preferred_countries',v)} hint={'Npr. '+Object.values(COUNTRIES).slice(0,3).join(', ')}/>
   <Multi label='Vrste nekretnina' values={TYPES} value={form.property_types} onChange={v=>set('property_types',v)}/>
   <Multi label='Prihvatljiva stanja' values={CONDITIONS} value={form.conditions} onChange={v=>set('conditions',v)}/>
   <div className='two-cols'><Text label='Površina od (m²)' type='number' value={form.min_area} onChange={v=>set('min_area',v)}/><Text label='Površina do (m²)' type='number' value={form.max_area} onChange={v=>set('max_area',v)}/></div>
   <Text label='Gradovi (zarezom, neobavezno)' value={form.cities} onChange={v=>set('cities',v)}/><Text label='Regije (zarezom, neobavezno)' value={form.regions} onChange={v=>set('regions',v)}/>
   <RequirementsEditor value={form.requirements} onChange={v=>set('requirements',v)}/>
   <label className='field'><span>Dodatni uvjeti (provjeravaju se zasebno za svaki par)</span><textarea rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
   <Text label='Izvor ovog zahtjeva (URL dokaza)' value={form.source_url} onChange={v=>set('source_url',v)}/><Text label='Datum provjere izvora' type='date' value={form.checked_at} onChange={v=>set('checked_at',v)} hint='Promjena izvora briše raniji datum i kontakt; upiši novu provjeru.'/>
   <div className='two-cols'><Text label='Budžet od € (neobavezno)' type='number' value={form.min_budget} onChange={v=>set('min_budget',v)}/><Text label='Budžet do € (neobavezno)' type='number' value={form.max_budget} onChange={v=>set('max_budget',v)}/></div>
   <label className='checkbox'><input type='checkbox' checked={form.verified} onChange={e=>set('verified',e.target.checked)}/>Zahtjev je provjeren na navedenom izvoru navedenog datuma.</label>
   <div className='modal-foot'><button className='secondary' type='button' onClick={()=>setForm(null)}>Odustani</button><button className='primary' type='button' disabled={busy} onClick={save}>Spremi zahtjev i ponovno izračunaj</button></div>
  </section>}
  <style>{`.request-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:16px 0}.request-card{padding:16px;border:1px solid #dce4df;border-radius:12px;background:#f7faf8}.request-card.inactive{opacity:.6}.request-card small{font-size:10px;letter-spacing:1px;color:#5d6f65}.request-card h4{margin:4px 0 8px}.request-card p{margin:4px 0;font-size:13px}.two-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.text-proposal{margin:12px 0}.proposal{border:1px solid #dce4df;border-radius:10px;padding:10px;margin:10px 0}.buyer-requests fieldset{border:0;padding:0}.buyer-requests .chips{display:flex;flex-wrap:wrap;gap:8px}@media(max-width:600px){.two-cols{grid-template-columns:1fr}}`}</style>
 </div>;
}
