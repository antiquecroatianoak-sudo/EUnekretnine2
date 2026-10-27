import {validUrl} from './domain.mjs';

export const AGENCY_POLICIES=['Nije navedeno','Prihvaća agencije','Izričito ne prihvaća agencije'];
export function validateAgencyPolicy(c){
 const policy=c.agency_policy;
 if(policy==null||policy==='Nije navedeno')return;
 if(!AGENCY_POLICIES.includes(policy))throw Error('Nepoznat stav prema agencijama.');
 if(!validUrl(c.agency_policy_source)||!String(c.agency_policy_quote||'').trim())throw Error('Za izričit stav prema agencijama navedi izvorni navod i URL dokaza.');
}
export function agencyPolicyRow(c){
 let explicit=false;
 try{validateAgencyPolicy(c);explicit=AGENCY_POLICIES.slice(1).includes(c.agency_policy)}catch{}
 const prohibited=explicit&&c.agency_policy===AGENCY_POLICIES[2];
 return {label:'Stav prema suradnji s agencijama',state:prohibited?'unknown':'info',
  status:prohibited?'Izričita zabrana – poštovati':explicit?'Navedeno u izvoru':'Nepoznato – ne blokira uparivanje',
  buyer:explicit?`${c.agency_policy} · ${c.agency_policy_quote} · ${c.agency_policy_source}`:'Nije navedeno; ne traži se posebna potvrda',
  property:'Kontakt za agencijski zapis ostaje njegova agencija',
  explanation:(prohibited?'Zabilježena je izričita zabrana; ne slati prijedlog koji bi je prekršio. ':explicit?'Ovo je navod izvora, a ne potvrda interesa za ovu nekretninu. ':'Nepoznat stav ne mijenja ocjenu, status para ni broj obveznih provjera. ')+
   'Prvi kontakt služi provjeri interesa uz opći opis bez adrese i kontakata stranaka. Službene ponude i daljnji postupak vodi agencija.'};
}
