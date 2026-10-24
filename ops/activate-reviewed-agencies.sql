begin;
select pg_advisory_xact_lock(hashtext('eu-property-reviewed-agency-registration'));
insert into sources(country,name,url,category)
select 'AT','NESTOR','https://www.immonestor.at/immobilien','Agencija — prodaja'
where not exists(select 1 from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='immonestor.at');
insert into discovery_runs(source_id,status,checked_at,body_json)
select 'registry-config-'||id,'Uspješno',now()::text,'{"entry_urls":["https://www.immonestor.at/immobilien"],"sale_scope":true,"require_structured_listing":true}'
from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='immonestor.at'
on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json;
insert into sources(country,name,url,category)
select 'AT','ADAMANT','https://www.adamant-immobilien.at/','Agencija — prodaja'
where not exists(select 1 from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='adamant-immobilien.at');
insert into discovery_runs(source_id,status,checked_at,body_json)
select 'registry-config-'||id,'Uspješno',now()::text,'{"entry_urls":["https://www.adamant-immobilien.at/"],"sale_scope":true,"require_structured_listing":true}'
from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='adamant-immobilien.at'
on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json;
insert into sources(country,name,url,category)
select 'AT','Immolution','https://www.immolution.at/','Agencija — prodaja'
where not exists(select 1 from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='immolution.at');
insert into discovery_runs(source_id,status,checked_at,body_json)
select 'registry-config-'||id,'Uspješno',now()::text,'{"entry_urls":["https://www.immolution.at/"],"sale_scope":true,"require_structured_listing":true}'
from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='immolution.at'
on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json;
insert into sources(country,name,url,category)
select 'AT','Raiffeisen Immobilien — Eisenstadt','https://www.raiffeisen-immobilien.at/de/wohnung-kaufen','Agencija — prodaja'
where not exists(select 1 from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='raiffeisen-immobilien.at');
insert into discovery_runs(source_id,status,checked_at,body_json)
select 'registry-config-'||id,'Uspješno',now()::text,'{"entry_urls":["https://www.raiffeisen-immobilien.at/de/wohnung-kaufen"],"sale_scope":true,"require_structured_listing":true,"detail_path_prefixes":["/de/immobilien/kauf/7000/eisenstadt/"]}'
from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='raiffeisen-immobilien.at'
on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json;
insert into sources(country,name,url,category)
select 'AT','Zweitwohnsitze','https://zweitwohnsitze.com/','Agencija — prodaja'
where not exists(select 1 from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='zweitwohnsitze.com');
insert into discovery_runs(source_id,status,checked_at,body_json)
select 'registry-config-'||id,'Uspješno',now()::text,'{"entry_urls":["https://zweitwohnsitze.com/"],"sale_scope":true,"require_structured_listing":true}'
from sources where regexp_replace(split_part(lower(url),'/',3),'^www\\.','')='zweitwohnsitze.com'
on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json;
commit;
