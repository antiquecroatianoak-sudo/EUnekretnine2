// Evidence policy: source reachability is not identity, availability or legal verification.
export const POLICY_VERSION = '2026-10-18-v1';
export function assessEvidence(row, now=Date.now()) {
 const f=row.facts||{},stamp=Date.parse(row.last_seen),missing=[];
 let source=false;try{const u=new URL(row.url);source=u.protocol==='https:'&&!u.username&&!u.password}catch{}
 const location=f.advertised_location||f.address||f.city||f.location;
 if(!source)missing.push('Izvorna poveznica');
 if(!Number.isFinite(stamp))missing.push('Datum provjere izvora');
 if(row.kind==='property'&&!location)missing.push('Lokacija iz pojedinačnog oglasa');
 const intent=typeof f.intent_evidence==='string'&&f.intent_evidence.trim().length>0&&f.intent_source_url===row.url;
 const identity=typeof f.entity_name==='string'&&f.entity_name.trim().length>0&&f.identity_source_url===row.url;
 if(row.kind==='buyer'&&!identity)missing.push('Dokaz identiteta osobe ili tvrtke');
 if(row.kind==='buyer'&&!intent)missing.push('Dokaz javne potražnje ili kriterija kupnje');
 return {
  policy_version:POLICY_VERSION,
  source_last_observed_at:Number.isFinite(stamp)?row.last_seen:null,
  freshness:Number.isFinite(stamp)&&stamp<=now&&now-stamp<=30*86400000?'Nedavno opažen izvor':'Potrebna ponovna provjera izvora',
  // A thirty-day freshness flag never establishes that a sale or mandate is still active.
  availability:'Nepotvrđeno; dostupnost zahtijeva zaseban dokaz',
  classification:row.kind==='buyer'?(identity&&intent?'Dokumentirana javna potražnja - za provjeru':'Potencijalni kontakt - za provjeru'):'Oglas nekretnine - za provjeru',
  missing,
  legal_status:'Nije potvrđeno oglasom',
  specific_purchase_interest:'Nepotvrđeno',
  assessed_at:new Date(now).toISOString()
 };
}


