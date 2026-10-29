// @ts-nocheck
'use client';
import {FACTS,OPS,UNITS,FACT_STATUS,FACT_ORIGIN,SECTOR_TEMPLATES} from '@/lib/facts.mjs';
// facts-v1 editors: documented buyer requirements and specialised property facts. The server validates both
// (facts.mjs); unknown stays empty here, never 0 or "ne".
const unitsFor=def=>Object.keys(UNITS).filter(u=>UNITS[u][0]===def.dim);
const today=()=>new Date().toISOString().slice(0,10);
function ValueInput({def,value,unit,onValue,onUnit,label,multiple=false}){
 if(def.type==='boolean')return <select aria-label={label} value={value===true?'da':value===false?'ne':''} onChange={e=>onValue(e.target.value===''?undefined:e.target.value==='da')}><option value=''>—</option><option value='da'>Da</option><option value='ne'>Ne</option></select>;
 if(def.type==='enum')return multiple?<select aria-label={label} multiple value={Array.isArray(value)?value:[]} onChange={e=>onValue([...e.target.selectedOptions].map(o=>o.value))}>{def.values.map(v=><option key={v}>{v}</option>)}</select>
  :<select aria-label={label} value={value??''} onChange={e=>onValue(e.target.value||undefined)}><option value=''>—</option>{def.values.map(v=><option key={v}>{v}</option>)}</select>;
 return <span className='value-unit'><input aria-label={label} type='number' min='0' step='any' value={value??''} onChange={e=>onValue(e.target.value===''?undefined:Number(e.target.value))}/>
  <select aria-label={label+' – jedinica'} value={unit||''} onChange={e=>onUnit(e.target.value)}>{unitsFor(def).map(u=><option key={u}>{u}</option>)}</select></span>;
}
export function RequirementsEditor({value=[],onChange}){
 const set=(n,patch)=>onChange(value.map((q,k)=>k===n?{...q,...patch}:q));
 const add=()=>{const key=Object.keys(FACTS)[0],def=FACTS[key];onChange([...value,{key,op:OPS[def.type][0],unit:unitsFor(def)[0],mandatory:true,quote:''}])};
 return <fieldset className='facts-editor'><legend>Dokumentirani dodatni uvjeti (facts-v1)</legend>
  <p className='muted'>Samo uvjeti koje izvor zahtjeva navodi, uz izvorni navod. Obavezan uvjet odlučuje o paru; želja je samo informativna. Nepoznat podatak nekretnine ostaje otvorena stavka.</p>
  {value.map((q,n)=>{const def=FACTS[q.key];return <div className='facts-row' key={n}>
   <select aria-label='Podatak' value={q.key} onChange={e=>{const d=FACTS[e.target.value];set(n,{key:e.target.value,op:OPS[d.type][0],value:undefined,unit:d.dim?unitsFor(d)[0]:undefined})}}>{Object.entries(FACTS).map(([k,d])=><option key={k} value={k}>{d.label}</option>)}</select>
   <select aria-label='Usporedba' value={q.op} onChange={e=>set(n,{op:e.target.value})}>{OPS[def.type].map(o=><option key={o} value={o}>{({min:'najmanje',max:'najviše',equals:'jednako',includes:'jedno od'})[o]}</option>)}</select>
   <ValueInput def={def} value={q.value} unit={q.unit} multiple={def.type==='enum'} label='Tražena vrijednost' onValue={v=>set(n,{value:v})} onUnit={u=>set(n,{unit:u})}/>
   {def.type==='enum'&&Array.isArray(q.value)&&!q.value.length&&<span className='error' role='alert'>Odaberi barem jednu vrijednost.</span>}
   <label className='checkbox'><input type='checkbox' checked={q.mandatory} onChange={e=>set(n,{mandatory:e.target.checked})}/>Obavezno</label>
   <input aria-label='Izvorni navod' placeholder='Izvorni navod zahtjeva' value={q.quote||''} onChange={e=>set(n,{quote:e.target.value})}/>
   <button className='text-button' type='button' onClick={()=>onChange(value.filter((_,k)=>k!==n))}>Ukloni</button></div>})}
  <button className='secondary' type='button' onClick={add}>Dodaj uvjet</button>
  {/* A sector template only lists fields: each row stays a wish without a value until the operator fills it from the source. */}
  <select aria-label='Predložak sektora' value='' onChange={e=>{const keys=SECTOR_TEMPLATES[e.target.value]||[];const have=new Set(value.map(q=>q.key));
   onChange([...value,...keys.filter(k=>!have.has(k)).map(k=>{const d=FACTS[k];return {key:k,op:OPS[d.type][0],unit:d.dim?unitsFor(d)[0]:undefined,mandatory:false,quote:''}})])}}>
   <option value=''>Predložak sektora…</option>{Object.keys(SECTOR_TEMPLATES).map(k=><option key={k}>{k}</option>)}</select></fieldset>;
}
// Property facts as stored text (facts_json); an empty object is saved as no facts.
export function FactsEditor({value,onChange}){
 let facts={};try{facts=value?JSON.parse(value):{}}catch{return <p className='error'>Spremljeni podaci nekretnine nisu valjan JSON; ispravak traži ručnu provjeru.</p>}
 const save=next=>onChange(Object.keys(next).length?JSON.stringify(next):'');
 const set=(k,patch)=>save({...facts,[k]:{...facts[k],...patch}});
 const unused=Object.keys(FACTS).filter(k=>!facts[k]);
 return <fieldset className='facts-editor'><legend>Specijalizirani podaci nekretnine (facts-v1)</legend>
  <p className='muted'>Svaki podatak ima izvor, datum i status. Potvrđen podatak traži dokaz; nepoznato ostaje neupisano.</p>
  {Object.entries(facts).map(([k,f])=>{const def=FACTS[k];if(!def)return <p className='error' key={k}>Nepoznat podatak: {k}</p>;return <div className='facts-row' key={k}>
   <b>{def.label}</b>
   <ValueInput def={def} value={f.value} unit={f.unit} label={def.label} onValue={v=>set(k,{value:v})} onUnit={u=>set(k,{unit:u})}/>
   <select aria-label={def.label+' – status'} value={f.status||''} onChange={e=>set(k,{status:e.target.value})}>{FACT_STATUS.map(v=><option key={v}>{v}</option>)}</select>
   <select aria-label={def.label+' – podrijetlo'} value={f.origin||''} onChange={e=>set(k,{origin:e.target.value})}>{FACT_ORIGIN.map(v=><option key={v}>{v}</option>)}</select>
   <input aria-label={def.label+' – dokaz'} placeholder='Dokaz (dokument, poveznica, zapisnik)' value={f.evidence||''} onChange={e=>set(k,{evidence:e.target.value||undefined})}/>
   <input aria-label={def.label+' – opaženo'} type='date' value={f.observed_on||''} onChange={e=>set(k,{observed_on:e.target.value})}/>
   <input aria-label={def.label+' – vrijedi do'} type='date' value={f.valid_until||''} onChange={e=>set(k,{valid_until:e.target.value||undefined})}/>
   <button className='text-button' type='button' onClick={()=>{const {[k]:_,...rest}=facts;save(rest)}}>Ukloni</button></div>})}
  {unused.length>0&&<select aria-label='Dodaj podatak' value='' onChange={e=>{const k=e.target.value,def=FACTS[k];if(k)save({...facts,[k]:{unit:def.dim?unitsFor(def)[0]:undefined,status:'nepotvrđeno',origin:'ručno',observed_on:today()}})}}>
   <option value=''>Dodaj podatak…</option>{unused.map(k=><option key={k} value={k}>{FACTS[k].label}</option>)}</select>}
  <style>{`.facts-editor{border:1px solid #dce4df;border-radius:10px;padding:12px;margin:12px 0}.facts-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.facts-row input,.facts-row select{min-width:0;max-width:100%}.value-unit{display:inline-flex;gap:4px}.req-table td,.req-table th{padding:4px 8px;text-align:left;vertical-align:top}.req-state-met{color:#1f6b45}.req-state-unmet{color:#9b2c1f}.req-state-unknown,.req-state-conflict,.req-state-expired,.req-state-future,.req-state-inverted,.req-state-unspecified{color:#8a5a00}@media(max-width:600px){.facts-row{flex-direction:column;align-items:stretch}}`}</style></fieldset>;
}
const STATE={met:'Odgovara',unmet:'Ne odgovara',unknown:'Podatak nije potvrđen',conflict:'Proturječan podatak',expired:'Zastario podatak',future:'Datum opažanja u budućnosti',inverted:'Proturječan raspon u zahtjevu',unspecified:'Zahtjev bez vrijednosti'};
const show=(v,u)=>v==null?'—':Array.isArray(v)?v.join(' / '):v===true?'Da':v===false?'Ne':String(v)+(u?' '+u:'');
// Requested vs actual per documented requirement, with evidence and state; the score stays separate.
export function RequirementsTable({rows}){
 if(!rows?.length)return null;
 return <div className='table-scroll'><table className='req-table'><caption className='muted'>Dokumentirani uvjeti zahtjeva</caption><thead><tr><th>Uvjet</th><th>Traženo</th><th>Stvarno</th><th>Dokaz</th><th>Stanje</th></tr></thead>
  <tbody>{rows.map(r=><tr key={r.key+r.op}><td>{r.label}{r.mandatory?'':' (želja)'}<br/><small className='muted'>„{r.quote}”</small></td><td>{({min:'≥ ',max:'≤ ',equals:'',includes:''})[r.op]}{show(r.requested,r.unit)}</td>
   <td>{show(r.actual,r.actual_unit)}</td><td>{r.evidence||'—'}</td><td className={'req-state-'+r.state}>{STATE[r.state]}</td></tr>)}</tbody></table></div>;
}
