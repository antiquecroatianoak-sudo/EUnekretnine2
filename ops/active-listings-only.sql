-- Run transactionally. Private invoker functions; no public API or RLS changes.
alter table public.properties add column if not exists activity_evidence text;

create or replace function site_private.listing_activity_valid(u text,f jsonb,at_time timestamptz default now())
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare checked timestamptz; ending timestamptz; k text; h text; eh text;
begin
 if u is null or u !~ '^https://[^/@ ]+/' or jsonb_typeof(f) is distinct from 'object' then return false; end if;
 if coalesce(f->>'source_listing_state','')<>'active' or coalesce(f->>'activity_record_url','')<>u
 or length(trim(coalesce(f->>'source_status_evidence','')))<12 then return false; end if;
 if coalesce(f->>'activity_evidence_url','') !~ '^https://[^/@ ]+/' then return false; end if;
 h:=lower(regexp_replace(substring(u from '^https://([^/:]+)'),'^(www\.)',''));
 eh:=lower(regexp_replace(substring(f->>'activity_evidence_url' from '^https://([^/:]+)'),'^(www\.)',''));
 if h is distinct from eh then return false; end if;
 if coalesce(f->>'checked_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return false; end if;
 checked:=site_private.safe_stamp(f->>'checked_at');
 if exists(select 1 from site_private.listing_activity_blocks b where b.url_hash=md5(rtrim(u,'/')) and b.blocked_at>=checked) then return false; end if;
 if checked is null or checked>at_time or checked<at_time-interval '24 hours' then return false; end if;
 foreach k in array array['deadline','bid_deadline_at','available_until','auction_at'] loop
  if nullif(f->>k,'') is not null then
   if f->>k !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return false; end if;
   ending:=site_private.safe_stamp(f->>k);
   if ending is null or ending<=at_time then return false; end if;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;

-- Reversible exclusion only. Physical deletion and historical cleanup are deliberately
-- excluded from this migration after automatic approval review rejected that scope.
create table if not exists site_private.listing_activity_blocks (
 url_hash text primary key, blocked_at timestamptz not null default now(), reason text not null
);
alter table site_private.listing_activity_blocks enable row level security;
revoke all on site_private.listing_activity_blocks from public,anon,authenticated;
create or replace function site_private.exclude_listing_url(u text)
returns integer language plpgsql security invoker set search_path='' as $$
begin
 insert into site_private.listing_activity_blocks(url_hash,reason)
 values(md5(rtrim(u,'/')),'Aktivnost nije potvrđena pri posljednjoj provjeri')
 on conflict(url_hash) do update set blocked_at=now(),reason=excluded.reason;
 return 0;
end $$;
create or replace function site_private.guard_active_candidate()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='property' and not site_private.listing_activity_valid(new.url,site_private.safe_json(new.body_json)->'facts',now()) then
  raise exception using errcode='23514',message='Property rejected: fresh record-bound activity evidence required';
 end if;
 return new;
end $$;

create or replace function site_private.guard_active_property()
returns trigger language plpgsql security invoker set search_path='' as $$
declare f jsonb;
begin
 if new.status in ('Prodano','Povučeno','Rok istekao - ishod nepoznat','Zatvoreno') then
  raise exception using errcode='23514',message='Inactive properties must be removed, not saved';
 end if;
 f:=site_private.safe_json(new.activity_evidence);
 if not site_private.listing_activity_valid(new.source,f,now()) then
  select site_private.safe_json(c.body_json)->'facts' into f from public.source_candidates c
   where c.kind='property' and rtrim(c.url,'/')=rtrim(new.source,'/')
   and site_private.listing_activity_valid(c.url,site_private.safe_json(c.body_json)->'facts',now())
   order by c.last_seen desc limit 1;
 end if;
 if not site_private.listing_activity_valid(new.source,f,now()) then
  raise exception using errcode='23514',message='Property rejected: activity not confirmed';
 end if;
 if nullif(new.available_until,'') is not null and coalesce(site_private.safe_stamp(new.available_until),'-infinity'::timestamptz)<=now()
 or (new.bid_deadline_at is not null and new.bid_deadline_at<=now()) then
  raise exception using errcode='23514',message='Expired property rejected';
 end if;
 new.activity_evidence:=f::text;
 new.source_checked_on:=(site_private.safe_stamp(f->>'checked_at') at time zone 'UTC')::date;
 if new.status is null or new.status in ('Novo','Provjera','Oglas - za provjeru') then new.status:='Aktivno'; end if;
 return new;
end $$;

-- Keep all existing contact checks. An active property can be a possible match;
-- it is not automatically legally verified or a confirmed buyer interest.
create or replace function site_private.guard_pair_contacts()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.properties p cross join public.investors i
  where p.id=new.property_id and i.id=new.investor_id
  and site_private.listing_activity_valid(p.source,site_private.safe_json(p.activity_evidence),now())
  and site_private.contact_usable(p.contact_json,p.source)
  and site_private.contact_usable(i.contact_json,(i.criteria_json::jsonb)->>'source_url')) then return null; end if;
 return new;
exception when invalid_text_representation then return null;
end $$;

-- Fail the migration before touching data if the predicate is not fail-closed.
do $$
declare u text:='https://example.com/listing/1'; f jsonb;
begin
 f:=jsonb_build_object('source_listing_state','active','source_status_evidence','Explicit primary status active',
  'activity_record_url',u,'activity_evidence_url',u,'checked_at',now());
 assert site_private.listing_activity_valid(u,f,now()),'Positive activity rejected';
 assert not site_private.listing_activity_valid(u,f-'source_listing_state',now()),'Unknown activity accepted';
 assert not site_private.listing_activity_valid(u,f||jsonb_build_object('source_listing_state','removed'),now()),'Removed accepted';
 assert not site_private.listing_activity_valid(u,f||jsonb_build_object('checked_at',now()+interval '1 second'),now()),'Future proof accepted';
 assert not site_private.listing_activity_valid(u,f||jsonb_build_object('checked_at',now()-interval '24 hours 1 second'),now()),'Stale proof accepted';
 assert not site_private.listing_activity_valid(u,f||jsonb_build_object('deadline',now()),now()),'Expired deadline accepted';
 assert not site_private.listing_activity_valid(u,f||jsonb_build_object('activity_record_url',u||'2'),now()),'Wrong record accepted';
 assert not site_private.listing_activity_valid(u,f||jsonb_build_object('activity_evidence_url','https://other.com/1'),now()),'Wrong source accepted';
end $$;

-- Existing explicit statuses are migrated only from reviewed record-status adapters.
-- This binds their ORIGINAL timestamp; it does not renew a source check.
update public.source_candidates c set body_json=jsonb_set(site_private.safe_json(c.body_json),'{facts}',
 (site_private.safe_json(c.body_json)->'facts')||jsonb_build_object('activity_record_url',c.url,
 'activity_evidence_url',coalesce(site_private.safe_json(c.body_json)->'facts'->>'evidence_url',c.url),
 'checked_at',c.last_seen))::text
where c.kind='property' and c.url ~ '^https://www\.(immobilier\.notaires\.fr|biddit\.be)/'
 and site_private.safe_json(c.body_json)->'facts'->>'source_listing_state'='active'
 and length(coalesce(site_private.safe_json(c.body_json)->'facts'->>'source_status_evidence',''))>=12;

update public.properties p set activity_evidence=(site_private.safe_json(c.body_json)->'facts')::text
from public.source_candidates c where c.property_id=p.id and c.kind='property'
and site_private.listing_activity_valid(c.url,site_private.safe_json(c.body_json)->'facts',now());

drop trigger if exists active_property_candidates_only on public.source_candidates;
create trigger active_property_candidates_only before insert or update on public.source_candidates
for each row execute function site_private.guard_active_candidate();
drop trigger if exists active_properties_only on public.properties;
create trigger active_properties_only before insert or update on public.properties
for each row execute function site_private.guard_active_property();

revoke all on function site_private.listing_activity_valid(text,jsonb,timestamptz),
 site_private.exclude_listing_url(text),
 site_private.guard_active_candidate(),site_private.guard_active_property() from public,anon,authenticated;

-- Cleanup is explicit and separately verified by the deployment operator:
-- select site_private.reconcile_listing_lifecycle();
