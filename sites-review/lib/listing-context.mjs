import {contactData,contactRoute,norm} from './domain.mjs';

// Internal display only. No fetching, writing or inference from a source's brand,
// an active-looking status, a recent ordinary save or a public contact address.
export function listingContext(row={}){
 let source=null;
 try{const url=new URL(row.source);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)source={url:url.href,host:url.hostname};}catch{}
 const basis=norm(row.price_basis);
 const priceBasis=['asking','asking_price','asking price','trazena cijena','trazena'].includes(basis)?'Tražena cijena':
  ['starting_bid','auction_starting_bid','minimum_bid','pocetna / minimalna ponuda na drazbi','pocetna cijena','pocetna cijena drazbe'].includes(basis)?'Početna / minimalna ponuda na dražbi':'Osnova cijene nije poznata';
 const closed=['Prodano','Povučeno','Zatvoreno','Rok istekao - ishod nepoznat'].includes(row.status);
 const availability=closed?'Potvrđeno neaktivan':row.availability_status==='Aktivnost potvrđena'?'Aktivnost potvrđena':'Dostupnost nije potvrđena';
 const route=contactRoute(row),contact=contactData(row);
 return {source,priceBasis,availability,contactLabel:route?(contact.permission_scope==='property_enquiry_only'?'Upit za ovaj oglas':route.label):'Kontakt treba dopuniti',
  contactName:route?.name||null,agency:typeof row.source_agency?.name==='string'?row.source_agency.name:null,
  record:Number.isSafeInteger(Number(row.id))&&Number(row.id)>0?'Zapis #'+row.id:null};
}
