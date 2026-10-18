begin; do $$
declare a text; n integer; stamp timestamptz:=now();
begin
 insert into public.source_candidates(id,source_id,kind,title,country,url,last_seen,body_json) values
 ('test:population:sale','test','property','Test individual property','HR','https://example.org/listing/1',stamp::text,jsonb_build_object('facts',jsonb_build_object('transaction_type','sale','asking_price',125000,'currency','EUR','city','Zagreb','property_type','Stan'))::text),
 ('test:population:profile','test','buyer','Test investor profile','HR','https://example.org/investor',stamp::text,'{"facts":{"transaction_type":"unconfirmed_acquisition_profile"}}'),
 ('test:population:demand','test','buyer','Test public demand','SI','https://example.org/oglasi-nakup/land_1234567/',stamp::text,'{"facts":{"budget":150000}}');
 assert site_private.sync_source_listing('test:population:sale')='synced','sale imported';
 assert (select property_id is not null from public.source_candidates where id='test:population:sale'),'sale linked';
 perform site_private.sync_source_listing('test:population:sale');
 assert (select count(*)=1 from public.properties where source='https://example.org/listing/1'),'duplicate not created';
 assert site_private.sync_source_listing('test:population:profile')='not_public_demand','profile excluded';
 assert site_private.sync_source_listing('test:population:demand')='synced','public demand imported';
 assert (select max_budget=150000 and verified=0 from public.investors where id=(select investor_id from public.source_candidates where id='test:population:demand')),'budget stored without declaring verified';
 perform site_private.mark_listing_unavailable('https://example.org/listing/1',403,stamp);
 assert (select state='observed' from site_private.listing_lifecycle where candidate_id='test:population:sale'),'403 does not remove';
 perform site_private.mark_listing_unavailable('https://example.org/listing/1',404,stamp-interval '25 hours');
 assert (select state='missing_once' from site_private.listing_lifecycle where candidate_id='test:population:sale'),'single 404 does not remove';
 perform site_private.mark_listing_unavailable('https://example.org/listing/1',404,stamp);
 assert (select state='removed' from site_private.listing_lifecycle where candidate_id='test:population:sale'),'repeated 404 removes';
 perform site_private.mark_listing_unavailable('https://example.org/oglasi-nakup/land_1234567/',410,stamp);
 assert (select state='removed' from site_private.listing_lifecycle where candidate_id='test:population:demand'),'410 removes demand';
 assert exists(select 1 from pg_trigger where tgname='verified_pairs_only'),'matching guard retained';
end $$; select 'population lifecycle integration checks passed' result; rollback;