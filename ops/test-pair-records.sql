-- Regressions for ops/pair-records.sql. Runs inside a transaction that is always rolled back.
begin;
do $$
declare p public.properties; i public.investors; pid integer:=2000000001; iid integer:=2000000001; cand text; n integer;
begin
 p:=jsonb_populate_record(null::public.properties,jsonb_build_object('id',pid,'country','Irska','city','Galway','title','TEST rollback pair','source','https://example.org/listing/pair',
  'price',100000,'area',600,'property_type','Zemljište','status','Aktivno','source_checked_on',current_date));
 -- Owner correction 6344490047: an undisclosed budget does not make a buyer ineligible.
 i:=jsonb_populate_record(null::public.investors,jsonb_build_object('id',iid,'name','TEST rollback buyer','verified',1,'min_budget',null,'max_budget',null,'preferred_countries','Irska',
  'criteria_json',jsonb_build_object('source_url','https://example.org/demand','checked_at',now(),'property_types',jsonb_build_array('Zemljište'),'conditions',jsonb_build_array('Neizgrađeno'))::text));
 assert site_private.investor_eligible(i),'unknown budget is eligible';
 i.max_budget:=100; i.min_budget:=500; assert not site_private.investor_eligible(i),'a known invalid range is still rejected';
 i.min_budget:=null; i.max_budget:=null;
 insert into public.properties select p.*;
 insert into public.investors select i.*;
 cand:=jsonb_build_object('status','Kandidat - potrebna provjera','phase','Mogući par – dopuna podataka o nekretnini','score',60,'reasons',jsonb_build_array('Država','Vrsta nekretnine'),
  'missing',jsonb_build_array('Dokaz pravne provjere','Ispunjenje dodatnih uvjeta kupca za ovu nekretninu'),'rejected','[]'::jsonb)::text;
 insert into public.match_results values(pid,iid,cand,now()::text);
 assert (select status='Kandidat - potrebna provjera' and in_latest_calculation from site_private.pair_records where property_id=pid and investor_id=iid),'pair recorded';
 assert (select count(*)=1 from site_private.pair_history where property_id=pid and investor_id=iid and event='Prvi izračun'),'first calculation in history';
 assert (select count(*)=2 from site_private.match_review_tasks where property_id=pid and investor_id=iid and status='Otvoreno'),'one task per open item';
 -- Manual progress survives a recalculation with the same result (the exported function reset it to 'Otvoreno').
 update site_private.match_review_tasks set status='U provjeri' where property_id=pid and investor_id=iid and requirement='Dokaz pravne provjere';
 update site_private.match_review_tasks set status='Provjereno',checked_at=now(),evidence='TEST' where property_id=pid and investor_id=iid and requirement like 'Ispunjenje%';
 update public.match_results set result_json=cand,updated=now()::text where property_id=pid and investor_id=iid;
 assert (select status='U provjeri' from site_private.match_review_tasks where property_id=pid and investor_id=iid and requirement='Dokaz pravne provjere'),'manual status kept';
 -- A verified item that the calculation still reports open has lost its evidence: reopened with the reason.
 assert (select status='Otvoreno' and status_reason like 'Dokaz više ne vrijedi%' from site_private.match_review_tasks where property_id=pid and investor_id=iid and requirement like 'Ispunjenje%'),'stale evidence reopened with reason';
 assert (select count(*)=1 from site_private.pair_history where property_id=pid and investor_id=iid),'an unchanged result adds no history';
 -- A verified item that left the missing list stays verified; other closed items are relabelled.
 update site_private.match_review_tasks set status='Provjereno',status_reason=null where property_id=pid and investor_id=iid and requirement like 'Ispunjenje%';
 update public.match_results set result_json=jsonb_set(cand::jsonb,'{missing}','["Dokaz pravne provjere"]')::text where property_id=pid and investor_id=iid;
 assert (select status='Provjereno' from site_private.match_review_tasks where property_id=pid and investor_id=iid and requirement like 'Ispunjenje%'),'verified item kept';
 assert (select count(*)=2 from site_private.pair_history where property_id=pid and investor_id=iid),'changed open items are recorded';
 -- A refresh that drops the pair (delete + cascade) keeps the record, its history and its tasks.
 delete from public.match_results where property_id=pid and investor_id=iid;
 assert not exists(select 1 from site_private.match_review_tasks where property_id=pid and investor_id=iid),'cascade still runs';
 assert (select not in_latest_calculation and left_at is not null from site_private.pair_records where property_id=pid and investor_id=iid),'record kept, marked as left';
 assert (select count(*)=2 from site_private.pair_task_archive where property_id=pid and investor_id=iid),'tasks archived';
 insert into public.match_results values(pid,iid,jsonb_set(cand::jsonb,'{missing}','["Dokaz pravne provjere"]')::text,now()::text);
 assert (select status='U provjeri' from site_private.match_review_tasks where property_id=pid and investor_id=iid and requirement='Dokaz pravne provjere'),'manual status restored on return';
 assert (select status='Provjereno' from site_private.match_review_tasks where property_id=pid and investor_id=iid and requirement like 'Ispunjenje%'),'verified status restored on return';
 assert (select in_latest_calculation and first_seen_at<=last_evaluated_at from site_private.pair_records where property_id=pid and investor_id=iid),'back in the calculation';
 assert exists(select 1 from site_private.pair_history where property_id=pid and investor_id=iid and event='Ponovno u izračunu'),'return recorded';
 assert not exists(select 1 from site_private.pair_task_archive where property_id=pid and investor_id=iid),'archive emptied';
 -- Confirmed interest needs a real opportunity; computing a match never creates it.
 begin
  insert into site_private.pair_stages(property_id,investor_id,stage,evidence,source,stage_on,recorded_by) values(pid,iid,'Potvrđen interes','TEST','TEST',current_date,'test');
  assert false,'interest on an open candidate must fail';
 exception when raise_exception then null; end;
 update public.properties set legal='Uredno',legal_evidence_url='https://example.org/legal' where id=pid;
 update public.match_results set result_json=jsonb_build_object('status','Podudaranje kriterija','phase','Stvarna prilika – interes kupca još nije potvrđen','score',100,
  'reasons',jsonb_build_array('Država','Vrsta nekretnine'),'missing','[]'::jsonb,'rejected','[]'::jsonb)::text where property_id=pid and investor_id=iid;
 assert (select status='Podudaranje kriterija' from site_private.pair_records where property_id=pid and investor_id=iid),'real opportunity with an unknown budget is accepted by the guard';
 assert not exists(select 1 from site_private.pair_stages where property_id=pid and investor_id=iid),'no stage is set by matching';
 begin
  insert into site_private.pair_stages(property_id,investor_id,stage,evidence,source,stage_on,recorded_by) values(pid,iid,'Realiziran posao','TEST','TEST',current_date,'test');
  assert false,'a deal without interest must fail';
 exception when raise_exception then null; end;
 insert into site_private.pair_stages(property_id,investor_id,stage,evidence,source,stage_on,recorded_by) values(pid,iid,'Potvrđen interes','E-pošta kupca 22.10.','Kupac',current_date,'test');
 insert into site_private.pair_stages(property_id,investor_id,stage,evidence,source,stage_on,recorded_by) values(pid,iid,'Realiziran posao','Ugovor ovjeren','Javni bilježnik',current_date,'test');
 -- Evidence log: no answer is marked verified without evidence, source and date, and none is edited.
 begin
  insert into site_private.pair_answers(property_id,investor_id,requirement,kind,body,status,recorded_by) values(pid,iid,'Dokaz pravne provjere','Odgovor','Vlasnik kaže da je uredno','Provjereno','test');
  assert false,'verified answer without evidence must fail';
 exception when check_violation then null; end;
 insert into site_private.pair_answers(property_id,investor_id,requirement,kind,addressed_to,body,status,recorded_by) values(pid,iid,'Dokaz pravne provjere','Nacrt pitanja','Prodavatelj','Možete li dostaviti izvadak?','Nacrt','test');
 begin
  update site_private.pair_answers set body='x' where property_id=pid;
  assert false,'answers are append-only';
 exception when raise_exception then null; end;
 select count(*) into n from site_private.pair_answers where property_id=pid;
 assert n=1;
end $$;
rollback;
