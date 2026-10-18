
create or replace function site_private.property_eligible(p public.properties) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare checked timestamptz;
begin
 if p.source !~ '^https?://[^/ ]+' or nullif(trim(p.city),'') is null or nullif(trim(p.country),'') is null
 or p.price is null or p.price<=0 or p.price::text in ('NaN','Infinity','-Infinity')
 or p.area is null or p.area<=0 or p.area::text in ('NaN','Infinity','-Infinity')
 or p.property_type not in ('Zemljište','Kuća','Stan','Zgrada','Poslovni prostor') or p.property_type is null
 or p.status not in ('Aktivno','Provjereno','Novo - aktivna dražba') or p.status is null then return false; end if;
 checked:=p.source_checked_on::timestamptz;
 if checked is null or checked>now() or checked<now()-interval '30 days' then return false; end if;
 if p.available_until is not null and p.available_until<>'' and p.available_until::date<current_date then return false; end if;
 if p.bid_deadline_at is not null and p.bid_deadline_at<now() then return false; end if;
 return true;
exception when others then return false;
end $$;
create or replace function site_private.investor_eligible(i public.investors) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare c jsonb; checked timestamptz;
begin
 c:=i.criteria_json::jsonb;
 if i.verified is distinct from 1 or jsonb_typeof(c)<>'object' or c is null
 or nullif(trim(i.preferred_countries),'') is null
 or i.min_budget is null or i.min_budget<0 or i.max_budget is null or i.max_budget<=0 or i.max_budget<i.min_budget
 or i.min_budget::text in ('NaN','Infinity','-Infinity') or i.max_budget::text in ('NaN','Infinity','-Infinity')
 or coalesce(c->>'source_url','') !~ '^https?://[^/ ]+'
 or coalesce(c->>'checked_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
 or jsonb_typeof(c->'property_types') is distinct from 'array'
 or jsonb_typeof(c->'conditions') is distinct from 'array' then return false; end if;
 if jsonb_array_length(c->'property_types')=0 or jsonb_array_length(c->'conditions')=0 then return false; end if;
 if exists(select 1 from jsonb_array_elements_text(c->'property_types') t(v) where v not in ('Zemljište','Kuća','Stan','Zgrada','Poslovni prostor')) then return false; end if;
 if exists(select 1 from jsonb_array_elements_text(c->'conditions') t(v) where v not in ('Useljivo','Za obnovu','Za rušenje','Neizgrađeno')) then return false; end if;
 checked:=(c->>'checked_at')::timestamptz;
 return coalesce(checked between now()-interval '90 days' and now(),false);
exception when others then return false;
end $$;
create or replace function site_private.guard_verified_pair() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.properties p where p.id=new.property_id and site_private.property_eligible(p))
 or not exists(select 1 from public.investors i where i.id=new.investor_id and site_private.investor_eligible(i))
 then return null; end if;
 return new;
end $$;
revoke all on function site_private.property_eligible(public.properties),site_private.investor_eligible(public.investors),site_private.guard_verified_pair() from public,anon,authenticated;
drop trigger if exists prepare_candidate_draft on public.source_candidates;
drop trigger if exists verified_pairs_only on public.match_results;
create trigger verified_pairs_only before insert or update on public.match_results for each row execute function site_private.guard_verified_pair();
create table if not exists site_private.excluded_match_history (property_id integer,investor_id integer,result_json text,updated text,excluded_at timestamptz default now(),reason text default 'Unverified record excluded from matching');
insert into site_private.excluded_match_history(property_id,investor_id,result_json,updated)
select m.* from public.match_results m
where not exists(select 1 from public.properties p where p.id=m.property_id and site_private.property_eligible(p))
or not exists(select 1 from public.investors i where i.id=m.investor_id and site_private.investor_eligible(i));
delete from public.match_results m
where not exists(select 1 from public.properties p where p.id=m.property_id and site_private.property_eligible(p))
or not exists(select 1 from public.investors i where i.id=m.investor_id and site_private.investor_eligible(i));
update public.notification_outbox n set status='Potrebna ponovna provjera' where n.status='Spremno'
and not exists(select 1 from public.match_results m where m.property_id=n.property_id and m.result_json::jsonb->>'status'='Podudaranje kriterija');
