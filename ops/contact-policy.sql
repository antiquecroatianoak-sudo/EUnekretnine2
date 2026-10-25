-- Additive contact storage; no grants, schedules, authentication or source rows change.
alter table public.properties add column if not exists contact_json text;
alter table public.investors add column if not exists contact_json text;
create or replace function site_private.contact_usable(payload text,reference text)
returns boolean language plpgsql immutable set search_path='' as $$
declare c jsonb;k text;v text;endpoint boolean:=false;
begin
 c:=payload::jsonb;
 if c is null or jsonb_typeof(c)<>'object' or c->>'mode' not in ('direct','agency') or c->>'mode' is null
 or c->'permitted' is distinct from 'true'::jsonb
 or nullif(trim(c->>'name'),'') is null or length(c->>'name')>2000
 or reference is null or reference !~ '^https?://[^/?#[:space:]@]+([/?#]|$)'
 or c->>'record_reference' is distinct from reference
 or coalesce(c->>'evidence_url','') !~ '^https?://[^/?#[:space:]@]+([/?#]|$)' then return false;end if;
 foreach k in array array['mode','name','agency_name','record_reference','email','phone','contact_url','evidence_url'] loop
  v:=c->>k;
  if v is not null and (jsonb_typeof(c->k)<>'string' or length(v)>2000 or v~'[[:cntrl:]]') then return false;end if;
 end loop;
 endpoint:=coalesce(c->>'email','')~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or (coalesce(c->>'phone','')~'^\+?[0-9 ()/.-]{7,30}$' and length(regexp_replace(c->>'phone','[^0-9]','','g'))>=7)
 or coalesce(c->>'contact_url','')~'^https?://[^/?#[:space:]@]+([/?#]|$)';
 if not endpoint then return false;end if;
 if c->>'mode'='agency' and (nullif(trim(c->>'agency_name'),'') is null or c->'represents_record' is distinct from 'true'::jsonb) then return false;end if;
 return true;
exception when others then return false;
end $$;
revoke all on function site_private.contact_usable(text,text) from public,anon,authenticated;
-- Guard all newly written operational pairs, including candidates. History stays untouched.
create or replace function site_private.guard_pair_contacts() returns trigger
language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.properties p cross join public.investors i
 where p.id=new.property_id and i.id=new.investor_id
 and site_private.contact_usable(p.contact_json,p.source)
 and site_private.contact_usable(i.contact_json,(i.criteria_json::jsonb)->>'source_url')) then return null;end if;
 return new;
exception when invalid_text_representation then return null;
end $$;
revoke all on function site_private.guard_pair_contacts() from public,anon,authenticated;
drop trigger if exists guard_pair_contacts on public.match_results;
create trigger guard_pair_contacts before insert or update on public.match_results for each row execute function site_private.guard_pair_contacts();
