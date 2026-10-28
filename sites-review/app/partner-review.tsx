// @ts-nocheck
'use client';
import {useState,useEffect} from 'react';
import {workflowCall} from './offer-workflow';
import {FACTS} from '@/lib/facts.mjs';
// Partner agency proposals (module 7): operator review only. A proposal changes nothing until it is accepted here,
// against the value it was made for; external partner access is off. Evidence and links are shown as plain text and
// never opened or fetched automatically.
const LABELS={legal_evidence_url:'Dokaz pravne provjere (URL)',planning_evidence_url:'Dokaz mogućnosti gradnje (URL)',price:'Cijena',area:'Površina',available_until:'Dostupno do'};
export const fieldLabel=f=>f.startsWith('facts.')?(FACTS[f.slice(6)]?.label||f):LABELS[f]||f;
const show=v=>v==null?'—':typeof v==='object'?[v.value===true?'Da':v.value===false?'Ne':Array.isArray(v.value)?v.value.join(' / '):String(v.value??'—'),v.unit,v.status&&'('+v.status+', '+v.origin+')'].filter(Boolean).join(' '):String(v);
const STATUS=['novo','prihvaćeno','odbijeno','zastarjelo','sve'];
async function tokenPair(){const b=crypto.getRandomValues(new Uint8Array(32));const token=btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return {token,hash:[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}}
export function PartnerReview({onClose}){
 const [data,setData]=useState(null),[status,setStatus]=useState('novo'),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[notes,setNotes]=useState({}),[msg,setMsg]=useState('');
 const [grant,setGrant]=useState({agency_source_id:'',record_ids:'',fields:[],days:7}),[token,setToken]=useState('');
 async function load(){setBusy(true);setErr('');try{const d=await workflowCall({action:'partner_proposals',status});if(!Array.isArray(d?.proposals))throw Error('Prijedlozi nisu učitani: neočekivan odgovor poslužitelja.');setData(d)}catch(e){setErr(e.message);setData(null)}finally{setBusy(false)}}
 useEffect(()=>{load()},[status]);
 async function act(body,done){setBusy(true);setErr('');setMsg('');try{const r=await workflowCall(body);if(r?.error)throw Error(r.error);setMsg(done(r));await load()}catch(e){setErr(e.message);setBusy(false)}}
 const decide=(p,decision)=>act({action:'partner_decide',id:p.id,decision,note:notes[p.id]||''},r=>r.status==='zastarjelo'?'Zapis se promijenio nakon prijedloga; prijedlog je označen kao zastario i ništa nije upisano.':decision==='prihvaćeno'?'Prijedlog je prihvaćen i upisan; parovi su ponovno izračunati.':'Prijedlog je odbijen; zapis nije mijenjan.');
 async function createGrant(){const t=await tokenPair();
  await act({action:'partner_grant_create',agency_source_id:Number(grant.agency_source_id),record_ids:grant.record_ids.split(/[\s,;]+/).filter(Boolean).map(Number),fields:grant.fields,days:Number(grant.days),token_hash:t.hash},
   r=>{setToken(t.token);return 'Pristup '+r.id+' vrijedi do '+new Date(r.expires_at).toLocaleDateString('hr-HR')+'. Ključ se prikazuje samo sada i ne sprema se.'})}
 return <div className='form-body partner-review'>
  <p className='muted'>{data?.config?.reason||'Vanjski pristup partnera nije uključen.'} Prijedlog ne mijenja zapis dok ga ovdje ne prihvatiš; prihvaća se samo ako se vrijednost u međuvremenu nije promijenila. Partnerski podatak ostaje nepotvrđen.</p>
  <div className='inline-actions'><select aria-label='Status prijedloga' value={status} onChange={e=>setStatus(e.target.value)}>{STATUS.map(s=><option key={s}>{s}</option>)}</select></div>
  {err&&<div className='error' role='alert'>{err} <button type='button' className='text-button' onClick={load}>Pokušaj ponovno</button></div>}
  {msg&&<p className='muted' role='status'>{msg}</p>}
  <ol className='partner-list'>{(data?.proposals||[]).map(p=><li key={p.id} className='partner-item'>
   <div><span className='pill'>{p.status}</span>{p.stale&&p.status==='novo'&&<span className='pill'>Zapis promijenjen nakon prijedloga</span>} <b>{fieldLabel(p.field)}</b> · {p.property_title||'Zapis '+p.property_id}</div>
   <p>Agencija: {p.agency_name||p.agency_source_id} · autor: {p.author} · {new Date(p.created_at).toLocaleString('hr-HR')}</p>
   <table className='req-table'><tbody><tr><th>Sada</th><td>{show(p.current)}</td></tr><tr><th>Predloženo</th><td>{show(p.value_json)}</td></tr><tr><th>Dokaz partnera</th><td className='partner-evidence'>{p.evidence}</td></tr>
    {p.decision_note&&<tr><th>Napomena</th><td>{p.decision_note}</td></tr>}</tbody></table>
   {p.status==='novo'&&<div className='inline-actions'><input aria-label='Napomena odluke' placeholder='Napomena (nije obavezna)' value={notes[p.id]||''} onChange={e=>setNotes({...notes,[p.id]:e.target.value})}/>
    <button type='button' disabled={busy||p.stale} onClick={()=>decide(p,'prihvaćeno')}>Prihvati</button><button className='secondary' type='button' disabled={busy} onClick={()=>decide(p,'odbijeno')}>Odbij</button></div>}
  </li>)}</ol>
  {data&&!data.proposals.length&&<p className='muted'>Nema prijedloga sa statusom „{status}”.</p>}
  <details><summary>Pristupi (samo interni staging)</summary>
   <ul>{(data?.grants||[]).map(g=><li key={g.id}>#{g.id} · {g.agency_name||g.agency_source_id} · {g.record_ids.length} zapisa · {g.fields.length} polja · do {new Date(g.expires_at).toLocaleDateString('hr-HR')}
    {g.revoked_at?' · opozvan':<button className='text-button' type='button' disabled={busy} onClick={()=>act({action:'partner_grant_revoke',id:g.id},()=>'Pristup '+g.id+' je opozvan.')}>Opozovi</button>}</li>)}</ul>
   <div className='offer-form'><select aria-label='Agencija pristupa' value={grant.agency_source_id} onChange={e=>setGrant({...grant,agency_source_id:e.target.value})}><option value=''>Agencija…</option>{(data?.agencies||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <input aria-label='Oznake zapisa' placeholder='Oznake zapisa (npr. 12, 15)' value={grant.record_ids} onChange={e=>setGrant({...grant,record_ids:e.target.value})}/>
    <select aria-label='Dopuštena polja' multiple value={grant.fields} onChange={e=>setGrant({...grant,fields:[...e.target.selectedOptions].map(o=>o.value)})}>{(data?.fields||[]).map(f=><option key={f} value={f}>{fieldLabel(f)}</option>)}</select>
    <input aria-label='Trajanje u danima' type='number' min='1' max='30' value={grant.days} onChange={e=>setGrant({...grant,days:e.target.value})}/>
    <button className='secondary' type='button' disabled={busy||!grant.agency_source_id||!grant.record_ids||!grant.fields.length} onClick={createGrant}>Izradi pristup</button>
    {token&&<p className='muted'>Ključ (prikazuje se jednom, ne šalje se): <code>{token}</code></p>}</div></details>
  {busy&&<p className='muted'>Učitavanje…</p>}
  <div className='modal-foot'><button className='secondary' type='button' onClick={()=>onClose?.()}>Zatvori</button></div>
  <style>{`.partner-list{padding-left:20px}.partner-item{margin:12px 0;padding:12px;border:1px solid #dce4df;border-radius:10px}.partner-item .pill{margin-right:6px}.partner-evidence{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:600px){.partner-list{padding-left:0;list-style:none}}`}</style>
 </div>;
}
