begin;
-- These exact primary pages invite property enquiries. This is a usable
-- enquiry channel, not partnership, feed/republication permission or interest.
update investors set contact_json=jsonb_build_object(
 'mode','direct','name','Kubikon Development d.o.o.','email','info@kubikon.hr',
 'contact_url','https://www.kubikon.hr/razvoj-nekretnina.html',
 'evidence_url','https://www.kubikon.hr/razvoj-nekretnina.html',
 'record_reference','https://www.kubikon.hr/razvoj-nekretnina.html',
 'permitted',true,'permission_scope','property_enquiry_only',
 'permission_quote','Otvoreni smo za razgovor o kvalitetnim lokacijama i razvojnim prilikama.',
 'checked_at',now()::text,
 'note','Izričit poziv na upit o zemljištu; partnerstvo, naknada, zemljopisni opseg i pojedinačni interes nisu potvrđeni.')::text,
 criteria_json=(site_private.safe_json(criteria_json)||jsonb_build_object('source_url','https://www.kubikon.hr/razvoj-nekretnina.html'))::text
where id=25 and name='Kubikon Development d.o.o.'
 and contact_json is null
 and site_private.safe_json(notes)->>'official_url'='https://www.kubikon.hr/razvoj-nekretnina.html'
 and nullif(site_private.safe_json(criteria_json)->>'source_url','') is null;
update properties set contact_json=jsonb_build_object(
 'mode','agency','name','Emporia d.o.o. Zadar','agency_name','Emporia d.o.o. Zadar',
 'phone','+385 23 300 000','contact_url',source,'evidence_url',source,
 'record_reference',source,'represents_record',true,'permitted',true,
 'permission_scope','property_enquiry_only','permission_quote','CALL US TODAY',
 'checked_at',now()::text,
 'note','Poziv za upit na konkretnoj stranici oglasa; suradnja i naknada nisu potvrđene.')::text
where contact_json is null and (
 id=16579 and source='https://www.emporia-realestate.com/property/urbanized-land-l586-zadar-okolica-murvica/'
 or id=16581 and source='https://www.emporia-realestate.com/property/urbanized-land-l275-sveti-filip-i-jakov-sveti-petar-na-moru/');
-- Fill only still-missing fields from each exact listing; no active/legal flag.
update properties set area=545 where id=16579 and area is null and source='https://www.emporia-realestate.com/property/urbanized-land-l586-zadar-okolica-murvica/';
update properties set area=2329 where id=16581 and area is null and source='https://www.emporia-realestate.com/property/urbanized-land-l275-sveti-filip-i-jakov-sveti-petar-na-moru/';
-- L275's displayed 200 EUR is per m², not its total purchase price.
update properties set price=465800,price_basis='asking'
where id=16581 and price=200 and price_basis is null and source='https://www.emporia-realestate.com/property/urbanized-land-l275-sveti-filip-i-jakov-sveti-petar-na-moru/';
insert into activity(property_id,investor_id,stage,notes,date)
select null,25,'Provjera kontakta','Službeni razvojni profil izričito poziva na razgovor o zemljištu: https://www.kubikon.hr/razvoj-nekretnina.html . Samo kanal upita, bez partnerstva ili potvrđenog interesa.',now()::text
where not exists(select 1 from activity where investor_id=25 and stage='Provjera kontakta' and notes like '%Samo kanal upita%');
insert into activity(property_id,stage,notes,date)
select p.id,'Provjera kontakta','Izričit CALL US TODAY na konkretnom oglasu: '||p.source||'. Samo upit; bez partnerstva. L586: 545 m² / 79.000 EUR. L275: 2329 m² × 200 EUR/m² = 465.800 EUR, nije 200 EUR ukupno.',now()::text
from properties p where p.id in(16579,16581)
and not exists(select 1 from activity a where a.property_id=p.id and a.stage='Provjera kontakta' and a.notes like '%Izričit CALL US TODAY%');
commit;
