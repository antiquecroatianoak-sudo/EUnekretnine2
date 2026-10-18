-- Listing intake is separate from verified matching. No verification guard is removed.
create table if not exists site_private.listing_lifecycle (
 candidate_id text primary key, state text not null default 'observed',
 checked_at timestamptz, evidence_url text, reason text,
 first_missing_at timestamptz, missing_count integer not null default 0,
 snapshot jsonb not null default '{}'::jsonb
);
alter table site_private.listing_lifecycle enable row level security;
revoke all on site_private.listing_lifecycle from public,anon,authenticated;
create or replace function site_private.safe_json(v text) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
begin return v::jsonb; exception when others then return '{}'::jsonb; end $$;
create or replace function site_private.safe_stamp(v text) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
begin
 if v ~ '^\d{4}-\d{2}-\d{2}$' then return (v::date+1)::timestamp at time zone 'UTC'; end if;
 if v !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return null; end if;
 return v::timestamptz;
exception when others then return null; end $$;
create or replace function site_private.sync_source_listing(cid text) returns text language plpgsql security invoker set search_path='' as $$
declare r public.source_candidates; f jsonb; oldsnap jsonb; snap jsonb; entity bigint; nation text; amount real; sqm real; loc text; typ text; budget real; c jsonb; stamp timestamptz;
begin
 select * into r from public.source_candidates where id=cid for update;
 if not found then return 'missing'; end if;
 f:=site_private.safe_json(r.body_json)->'facts';
 if r.url !~ '^https://[^/ ]+/.+' or length(trim(r.title))<8 then return 'not_individual'; end if;
 nation:=case upper(trim(r.country)) when 'AT' then 'Austrija' when 'BE' then 'Belgija' when 'BG' then 'Bugarska' when 'HR' then 'Hrvatska' when 'CY' then 'Cipar' when 'CZ' then 'Češka' when 'DK' then 'Danska' when 'EE' then 'Estonija' when 'FI' then 'Finska' when 'FR' then 'Francuska' when 'DE' then 'Njemačka' when 'GR' then 'Grčka' when 'HU' then 'Mađarska' when 'IE' then 'Irska' when 'IT' then 'Italija' when 'LV' then 'Latvija' when 'LT' then 'Litva' when 'LU' then 'Luksemburg' when 'MT' then 'Malta' when 'NL' then 'Nizozemska' when 'PL' then 'Poljska' when 'PT' then 'Portugal' when 'RO' then 'Rumunjska' when 'SK' then 'Slovačka' when 'SI' then 'Slovenija' when 'ES' then 'Španjolska' when 'SE' then 'Švedska' else trim(r.country) end;
 if nation not in ('Austrija','Belgija','Bugarska','Hrvatska','Cipar','Češka','Danska','Estonija','Finska','Francuska','Njemačka','Grčka','Mađarska','Irska','Italija','Latvija','Litva','Luksemburg','Malta','Nizozemska','Poljska','Portugal','Rumunjska','Slovačka','Slovenija','Španjolska','Švedska') then return 'outside_eu'; end if;
 if r.kind='property' and coalesce(f->>'transaction_type','') not in ('sale','auction') and not (f ? 'auction_id' or f ? 'source_listing_url') then return 'sale_not_documented'; end if;
 if r.kind='buyer' and not (r.url ~ '/oglasi-nakup/.+_[0-9]+' or (f->>'transaction_type'='buy_request' and length(coalesce(f->>'evidence_excerpt',''))>20)) then return 'not_public_demand'; end if;
 if r.kind not in ('property','buyer') then return 'unknown_kind'; end if;
 perform pg_advisory_xact_lock(1422569624,4);
 select snapshot into oldsnap from site_private.listing_lifecycle where candidate_id=cid;
 oldsnap:=coalesce(oldsnap,site_private.safe_json(r.body_json)->'auto_draft_snapshot','{}'::jsonb);
 insert into site_private.listing_lifecycle(candidate_id,checked_at,evidence_url) values(cid,site_private.safe_stamp(r.last_seen),r.url) on conflict do nothing;
 if r.kind='property' then
  amount:=case when f->>'currency'='EUR' then site_private.draft_number(f->'asking_price') else null end;
  sqm:=coalesce(site_private.draft_number(f->'area_m2'),site_private.draft_number(f->'area'),site_private.draft_number(f->'advertised_area'->'value'));
  loc:=coalesce(nullif(f->>'city',''),nullif(f->'advertised_location'->>'addressLocality',''));
  typ:=case when f->>'property_type' in ('Zemljište','Kuća','Stan','Zgrada','Poslovni prostor') then f->>'property_type' else null end;
  entity:=r.property_id;
  if entity is null then select id into entity from public.properties where rtrim(source,'/')=rtrim(r.url,'/') order by id limit 1; end if;
  if entity is null then
   insert into public.properties(country,city,title,source,price,area,property_type,legal,status,updated,risk_notes) values(nation,loc,r.title,r.url,amount,sqm,typ,'Nepoznato','Oglas - za provjeru',r.last_seen,'Internetski prodajni oglas; dostupnost i pravna urednost nisu potvrđeni samim dohvatom.') returning id into entity;
  else
   update public.properties p set
    title=case when p.title=oldsnap->>'title' then r.title else p.title end,
    price=case when amount is not null and (p.price is null or p.price is not distinct from site_private.draft_number(oldsnap->'price')) then amount else p.price end,
    area=case when sqm is not null and (p.area is null or p.area is not distinct from site_private.draft_number(oldsnap->'area')) then sqm else p.area end,
    city=case when loc is not null and (p.city is null or p.city=oldsnap->>'city') then loc else p.city end,
    property_type=case when typ is not null and (p.property_type is null or p.property_type=oldsnap->>'property_type') then typ else p.property_type end,
    updated=r.last_seen where p.id=entity;
  end if;
  update public.source_candidates set property_id=entity where id=cid and property_id is distinct from entity;
  snap:=jsonb_build_object('title',r.title,'price',amount,'area',sqm,'city',loc,'property_type',typ);
 else
  budget:=case when coalesce(f->>'budget_unit','') not in ('EUR/m2','EUR/m²','€/m²') and not (f ? 'unit_budget') then site_private.draft_number(f->'budget') else null end;
  entity:=r.investor_id;
  if entity is null then select id into entity from public.investors where site_private.safe_json(criteria_json)->>'source_url'=r.url order by id limit 1; end if;
  if entity is null then
   c:=jsonb_build_object('source_url',r.url,'checked_at',r.last_seen,'candidate_source_id',cid,'listing_kind','public_buy_request');
   for typ in select k from jsonb_object_keys(coalesce(f,'{}'::jsonb)) as k where k in ('property_types','conditions','cities','regions','min_area','max_area','requires_buildable') loop c:=c||jsonb_build_object(typ,f->typ); end loop;
   insert into public.investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) values(r.title,nation,null,budget,nation,'Javni oglas potražnje; identitet krajnjeg kupca i interes za pojedinu nekretninu nisu potvrđeni.',0,c::text) returning id into entity;
  else
   update public.investors i set max_budget=case when budget is not null and (i.max_budget is null or i.max_budget is not distinct from site_private.draft_number(oldsnap->'max_budget')) then budget else i.max_budget end where i.id=entity;
  end if;
  update public.source_candidates set investor_id=entity where id=cid and investor_id is distinct from entity;
  snap:=jsonb_build_object('max_budget',budget);
 end if;
 update site_private.listing_lifecycle set snapshot=snap where candidate_id=cid;
 update site_private.listing_lifecycle set state='observed',checked_at=site_private.safe_stamp(r.last_seen),first_missing_at=null,missing_count=0,reason=null where candidate_id=cid and site_private.safe_stamp(r.last_seen)>checked_at;
 stamp:=site_private.safe_stamp(f->>'deadline');
 if stamp is not null and stamp<=now() then update site_private.listing_lifecycle set state='expired',reason='Istekao dokumentirani rok izvornog oglasa',evidence_url=r.url,checked_at=now() where candidate_id=cid; end if;
 if f->>'source_listing_state' in ('removed','expired') and length(coalesce(f->>'source_status_evidence',''))>0 then update site_private.listing_lifecycle set state=f->>'source_listing_state',reason=f->>'source_status_evidence',checked_at=site_private.safe_stamp(r.last_seen),evidence_url=r.url where candidate_id=cid; end if;
 return 'synced';
end $$;
create or replace function site_private.mark_listing_unavailable(u text, code integer, checked timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare r record;
begin
 if code not in (404,410) or checked>now()+interval '1 minute' then return; end if;
 for r in select id from public.source_candidates where rtrim(url,'/')=rtrim(u,'/') loop
  insert into site_private.listing_lifecycle(candidate_id,state,checked_at,evidence_url,reason,first_missing_at,missing_count) values(r.id,case when code=410 then 'removed' else 'missing_once' end,checked,u,'HTTP '||code,checked,1)
  on conflict(candidate_id) do update set
   state=case when code=410 or (listing_lifecycle.first_missing_at is not null and checked-listing_lifecycle.first_missing_at>=interval '24 hours') then 'removed' else 'missing_once' end,
   first_missing_at=coalesce(listing_lifecycle.first_missing_at,checked),missing_count=listing_lifecycle.missing_count+1,checked_at=checked,evidence_url=u,reason='HTTP '||code;
 end loop;
end $$;
create or replace function site_private.reconcile_listing_lifecycle() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update site_private.listing_lifecycle l set state='expired',reason='Istekao dokumentirani rok',checked_at=now()
 from public.source_candidates c where c.id=l.candidate_id and l.state not in ('expired','removed') and site_private.safe_stamp(site_private.safe_json(c.body_json)->'facts'->>'deadline')<=now();
 get diagnostics n=row_count;
 insert into site_private.excluded_match_history(property_id,investor_id,result_json,updated,reason)
 select m.property_id,m.investor_id,m.result_json,m.updated,'Istekao ili uklonjen izvorni oglas' from public.match_results m where exists(select 1 from public.source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where l.state in ('expired','removed') and (c.property_id=m.property_id or c.investor_id=m.investor_id));
 delete from public.match_results m where exists(select 1 from public.source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where l.state in ('expired','removed') and (c.property_id=m.property_id or c.investor_id=m.investor_id));
 update public.notification_outbox o set status='Potrebna ponovna provjera' where o.status='Spremno' and exists(select 1 from public.source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=o.property_id and l.state in ('expired','removed'));
 return n;
end $$;
revoke all on function site_private.safe_json(text),site_private.safe_stamp(text),site_private.sync_source_listing(text),site_private.mark_listing_unavailable(text,integer,timestamptz),site_private.reconcile_listing_lifecycle() from public,anon,authenticated;

create or replace function site_private.guard_verified_pair() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.properties p where p.id=new.property_id and site_private.property_eligible(p))
 or not exists(select 1 from public.investors i where i.id=new.investor_id and site_private.investor_eligible(i))
 or exists(select 1 from public.source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where l.state in ('expired','removed') and (c.property_id=new.property_id or c.investor_id=new.investor_id))
 then return null; end if;
 return new;
end $$;
revoke all on function site_private.guard_verified_pair() from public,anon,authenticated;
