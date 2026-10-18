
begin;
do $$
declare p public.properties; i public.investors; n integer;
begin
 p:=jsonb_populate_record(null::public.properties,jsonb_build_object('id',2000000000,'country','Hrvatska','city','Test','title','TEST rollback','source','https://example.org/listing','price',100000,'area',100,'property_type','Stan','status','Aktivno','source_checked_on',current_date));
 assert site_private.property_eligible(p),'complete active property';
 p.status:='Provjera'; assert not site_private.property_eligible(p),'draft rejected';
 p.status:='Aktivno'; p.source_checked_on:=current_date-31; assert not site_private.property_eligible(p),'stale rejected';
 p.source_checked_on:=current_date+1; assert not site_private.property_eligible(p),'future rejected';
 p.source_checked_on:=current_date; p.bid_deadline_at:=now()-interval '1 hour'; assert not site_private.property_eligible(p),'expired auction rejected';
 p.bid_deadline_at:=null;
 i:=jsonb_populate_record(null::public.investors,jsonb_build_object('id',2000000000,'name','TEST rollback','verified',1,'min_budget',0,'max_budget',200000,'preferred_countries','HR','criteria_json',jsonb_build_object('source_url','https://example.org/demand','checked_at',now(),'property_types',jsonb_build_array('Stan'),'conditions',jsonb_build_array('Useljivo'))::text));
 assert site_private.investor_eligible(i),'complete investor';
 i.verified:=0; assert not site_private.investor_eligible(i),'unverified investor rejected';
 i.verified:=1; i.max_budget:=null; assert not site_private.investor_eligible(i),'missing budget rejected';
 i.max_budget:=200000; i.criteria_json:='{broken'; assert not site_private.investor_eligible(i),'malformed criteria rejected';
 i.criteria_json:=jsonb_build_object('source_url','https://example.org/demand','checked_at',now(),'property_types',jsonb_build_array('Stan'),'conditions',jsonb_build_array('Useljivo'))::text;
 insert into public.properties select p.*;
 insert into public.investors select i.*;
 insert into public.match_results(property_id,investor_id,result_json,updated) values(p.id,i.id,'{"status":"TEST"}',now()::text);
 select count(*) into n from public.match_results where property_id=p.id and investor_id=i.id;
 assert n=1,'valid pair accepted';
 update public.properties set status='Provjera' where id=p.id;
 update public.match_results set result_json='{"status":"SHOULD NOT WRITE"}' where property_id=p.id and investor_id=i.id;
 assert (select result_json='{"status":"TEST"}' from public.match_results where property_id=p.id and investor_id=i.id),'invalid update blocked';
 delete from public.match_results where property_id=p.id and investor_id=i.id;
 insert into public.match_results(property_id,investor_id,result_json,updated) values(p.id,i.id,'{"status":"SHOULD NOT WRITE"}',now()::text);
 assert not exists(select 1 from public.match_results where property_id=p.id and investor_id=i.id),'invalid insert blocked';
end $$;
select '11 verification and write-guard assertions passed; test rows rolled back' as result;
rollback;