// @ts-nocheck
'use client';
import {useState,useEffect} from 'react';
import {workflowCall} from './offer-workflow';
// Data-completion queue (module 2): what to complete first, from stored pairs only. Ordering never hides a candidate
// and a filled item is not a confirmed opportunity; drafts are copied by hand, nothing is sent.
const SIDE={property:'Nekretnina',buyer:'Zahtjev kupca',pair:'Par'};
export function CompletionQueue({onClose}){
 const [items,setItems]=useState([]),[meta,setMeta]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[side,setSide]=useState(''),[agency,setAgency]=useState(''),[open,setOpen]=useState(''),[copied,setCopied]=useState('');
 async function load(offset=0){setBusy(true);setErr('');try{const d=await workflowCall({action:'completion_queue',offset,limit:50,...(side?{side}:{}),...(agency?{agency_id:Number(agency)}:{})});
  if(!Array.isArray(d?.items)||!d.totals)throw Error('Red dopuna nije učitan: neočekivan odgovor poslužitelja.');setItems(x=>offset?[...x,...d.items]:d.items);setMeta(d)}catch(e){setErr(e.message);if(!offset)setItems([])}finally{setBusy(false)}}
 useEffect(()=>{load(0)},[side,agency]);
 async function copy(text){try{await navigator.clipboard.writeText(text);setCopied('Nacrt je kopiran. Ništa nije poslano.')}catch{setCopied('Kopiranje nije dostupno; označi tekst ručno.')}}
 return <div className='form-body completion-queue'>
  <p className='muted'>Redoslijed pokazuje što prvo dopuniti prema spremljenim parovima. Svi kandidati ostaju vidljivi; dopuna nije potvrda prilike. Budžet ne utječe na redoslijed.</p>
  {meta&&<p><b>{meta.total}</b> stavki · {meta.totals.pairs} parova · {meta.totals.requests} zahtjeva · {meta.totals.buyers} različitih kupaca</p>}
  <div className='inline-actions'><select aria-label='Strana' value={side} onChange={e=>setSide(e.target.value)}><option value=''>Sve strane</option>{Object.entries(SIDE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
   <select aria-label='Agencija' value={agency} onChange={e=>setAgency(e.target.value)}><option value=''>Sve (i bez agencije)</option>{(meta?.agencies||[]).map(a=><option key={a.id} value={a.id}>{a.name} · {a.items} stavki</option>)}</select></div>
  {err&&<div className='error' role='alert'>{err} <button type='button' className='text-button' onClick={()=>load(0)}>Pokušaj ponovno</button></div>}
  {copied&&<p className='muted' role='status'>{copied}</p>}
  <ol className='completion-list'>{items.map(it=><li key={it.key} className='completion-item'>
   <div><span className='pill'>{SIDE[it.side]}</span>{it.stale&&<span className='pill'>Zastarjelo / nepotvrđeno</span>} <b>{it.label}</b></div>
   <p>{it.property&&<>Nekretnina: {it.property.title}{it.property.city?' · '+it.property.city:''}</>}{it.property&&it.request&&<br/>}{it.request&&<>Zahtjev: {it.request.label||'Osnovni zahtjev'} · {it.request.name}</>}{it.agency&&<><br/>Izvorna agencija: {it.agency.name}</>}</p>
   <ul>{it.why.map(w=><li key={w}>{w}</li>)}</ul>
   {it.prior_checks.length>0&&<details><summary>Prije upita provjeri</summary><ol>{it.prior_checks.map(c=><li key={c}>{c}</li>)}</ol></details>}
   <button className='text-button' type='button' onClick={()=>setOpen(open===it.key?'':it.key)}>{open===it.key?'Sakrij nacrt':'Nacrt pitanja'}</button>
   {open===it.key&&<div className='offer-form'><p className='muted'>{it.draft.status} · za: {it.draft.addressed_to}</p><textarea aria-label='Nacrt pitanja' readOnly rows={3} value={it.draft.body}/><button className='secondary' type='button' onClick={()=>copy(it.draft.body)}>Kopiraj nacrt</button></div>}
  </li>)}</ol>
  {!items.length&&!busy&&!err&&<p className='muted'>Nema otvorenih stavki u spremljenim parovima.</p>}
  {meta?.next!=null&&<button className='secondary' type='button' disabled={busy} onClick={()=>load(meta.next)}>Učitaj još ({meta.total-items.length})</button>}
  {busy&&<p className='muted'>Učitavanje…</p>}
  <div className='modal-foot'><button className='secondary' type='button' onClick={()=>onClose?.()}>Zatvori</button></div>
  <style>{`.completion-list{padding-left:20px}.completion-item{margin:12px 0;padding:12px;border:1px solid #dce4df;border-radius:10px}.completion-item .pill{margin-right:6px}.completion-item ul{margin:6px 0;padding-left:18px;font-size:13px}@media(max-width:600px){.completion-list{padding-left:0;list-style:none}}`}</style>
 </div>;
}
