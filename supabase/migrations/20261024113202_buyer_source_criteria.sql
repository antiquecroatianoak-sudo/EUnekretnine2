-- Review before applying. No verification guard, RLS policy or business phase is relaxed.
-- Source-owned values may advance; manual changes and explicit clears are protected.
create or replace function site_private.source_country_name(v text) returns text
language sql immutable security invoker set search_path='' as $$ select case upper(trim(v)) when 'AT' then 'Austrija' when 'BE' then 'Belgija' when 'BG' then 'Bugarska' when 'HR' then 'Hrvatska' when 'CY' then 'Cipar' when 'CZ' then 'Češka' when 'DK' then 'Danska' when 'EE' then 'Estonija' when 'FI' then 'Finska' when 'FR' then 'Francuska' when 'DE' then 'Njemačka' when 'GR' then 'Grčka' when 'HU' then 'Mađarska' when 'IE' then 'Irska' when 'IT' then 'Italija' when 'LV' then 'Latvija' when 'LT' then 'Litva' when 'LU' then 'Luksemburg' when 'MT' then 'Malta' when 'NL' then 'Nizozemska' when 'PL' then 'Poljska' when 'PT' then 'Portugal' when 'RO' then 'Rumunjska' when 'SK' then 'Slovačka' when 'SI' then 'Slovenija' when 'ES' then 'Španjolska' when 'SE' then 'Švedska' else trim(v) end $$;
create or replace function site_private.source_buyer_criteria(f jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare c jsonb:='{}'::jsonb; k text;
begin
 if jsonb_typeof(f) is distinct from 'object' then return c; end if;
 for k in select unnest(array['property_types','conditions','cities','regions','min_area','max_area','requires_buildable','area_hard','preferred_locations','locations','required_criteria','required','original_property_types','min_area_m2','max_area_m2']) loop
  if f ? k and f->k<>'null'::jsonb then c:=c||jsonb_build_object(k,f->k); end if;
 end loop;
 if f->>'buyer_type'='public_authority' then c:=c||jsonb_build_object('buyer_kind','Javno tijelo'); end if;
 if nullif(f->>'listing_kind','') is not null then c:=c||jsonb_build_object('listing_kind',f->>'listing_kind'); end if;
 if nullif(f->>'deadline','') is not null then c:=c||jsonb_build_object('call_deadline',f->>'deadline'); end if;
 if f->>'source_listing_state' in ('expired','removed') then c:=c||jsonb_build_object('call_closed',coalesce(nullif(f->>'source_status_evidence',''),f->>'source_listing_state'));
 elsif site_private.safe_stamp(f->>'deadline')<=now() then c:=c||jsonb_build_object('call_closed','Istekao dokumentirani rok izvornog poziva'); end if;
 return c;
end $$;
create or replace function site_private.source_buyer_interest(f jsonb,nation text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare result text; values_json jsonb;
begin
 values_json:=case when jsonb_typeof(f->'preferred_countries')='array' then f->'preferred_countries'
 when jsonb_typeof(f->'preferred_countries')='string' then to_jsonb(string_to_array(f->>'preferred_countries',',')) else '[]'::jsonb end;
 select string_agg(n,',' order by first_position) into result from
 (select site_private.source_country_name(v) as n,min(ord) as first_position from jsonb_array_elements_text(values_json) with ordinality a(v,ord) group by site_private.source_country_name(v)) t
 where n in ('Austrija','Belgija','Bugarska','Hrvatska','Cipar','Češka','Danska','Estonija','Finska','Francuska','Njemačka','Grčka','Mađarska','Irska','Italija','Latvija','Litva','Luksemburg','Malta','Nizozemska','Poljska','Portugal','Rumunjska','Slovačka','Slovenija','Španjolska','Švedska');
 return coalesce(result,case when nation in ('Austrija','Belgija','Bugarska','Hrvatska','Cipar','Češka','Danska','Estonija','Finska','Francuska','Njemačka','Grčka','Mađarska','Irska','Italija','Latvija','Litva','Luksemburg','Malta','Nizozemska','Poljska','Portugal','Rumunjska','Slovačka','Slovenija','Španjolska','Švedska') then nation else '' end);
end $$;

CREATE OR REPLACE FUNCTION site_private.sync_source_listing(cid text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.source_candidates; f jsonb; oldsnap jsonb; snap jsonb; entity bigint; nation text; amount real; sqm real; loc text; typ text; budget real; c jsonb; stamp timestamptz; incoming jsonb; previous jsonb; protected jsonb; interest text; seat text; buyer public.investors; manual_interest boolean:=false; manual_budget boolean:=false;
begin
 select * into r from public.source_candidates where id=cid for update;
 if not found then return 'missing'; end if;
 f:=site_private.safe_json(r.body_json)->'facts';
 if r.url !~ '^https://[^/ ]+/.+' or length(trim(r.title))<8 then return 'not_individual'; end if;
 nation:=case upper(trim(r.country)) when 'AT' then 'Austrija' when 'BE' then 'Belgija' when 'BG' then 'Bugarska' when 'HR' then 'Hrvatska' when 'CY' then 'Cipar' when 'CZ' then 'Češka' when 'DK' then 'Danska' when 'EE' then 'Estonija' when 'FI' then 'Finska' when 'FR' then 'Francuska' when 'DE' then 'Njemačka' when 'GR' then 'Grčka' when 'HU' then 'Mađarska' when 'IE' then 'Irska' when 'IT' then 'Italija' when 'LV' then 'Latvija' when 'LT' then 'Litva' when 'LU' then 'Luksemburg' when 'MT' then 'Malta' when 'NL' then 'Nizozemska' when 'PL' then 'Poljska' when 'PT' then 'Portugal' when 'RO' then 'Rumunjska' when 'SK' then 'Slovačka' when 'SI' then 'Slovenija' when 'ES' then 'Španjolska' when 'SE' then 'Švedska' else trim(r.country) end;
 if r.kind='property' and nation not in ('Austrija','Belgija','Bugarska','Hrvatska','Cipar','Češka','Danska','Estonija','Finska','Francuska','Njemačka','Grčka','Mađarska','Irska','Italija','Latvija','Litva','Luksemburg','Malta','Nizozemska','Poljska','Portugal','Rumunjska','Slovačka','Slovenija','Španjolska','Švedska') then return 'outside_eu'; end if;
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
  incoming:=site_private.source_buyer_criteria(f);
  interest:=site_private.source_buyer_interest(f,nation);
  seat:=site_private.source_country_name(coalesce(nullif(f->>'seat_country',''),nullif(f->>'headquarters_country',''),r.country));
  entity:=r.investor_id;
  if entity is null then select id into entity from public.investors where site_private.safe_json(criteria_json)->>'source_url'=r.url order by id limit 1; end if;
  if entity is null and nullif(interest,'') is null then return 'no_eu_interest'; end if;
  protected:=case when jsonb_typeof(oldsnap->'protected_criteria')='array' then oldsnap->'protected_criteria' else '[]'::jsonb end;
  previous:=coalesce(oldsnap->'applied_criteria',oldsnap->'criteria','{}'::jsonb);
  if entity is null then
   c:=incoming||jsonb_build_object('source_url',r.url,'checked_at',r.last_seen,'candidate_source_id',cid,'listing_kind',coalesce(incoming->>'listing_kind','public_buy_request'));
   insert into public.investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) values(r.title,seat,null,budget,interest,'Javni oglas potražnje; identitet krajnjeg kupca i interes za pojedinu nekretninu nisu potvrđeni.',0,c::text) returning id into entity;
  else
   select * into buyer from public.investors where id=entity;
   interest:=coalesce(nullif(site_private.source_buyer_interest(f,null),''),nullif(oldsnap->>'preferred_countries',''),nullif(buyer.preferred_countries,''),interest);
   manual_interest:=coalesce(oldsnap->'preferred_countries_manual'='true'::jsonb,false)
    or (oldsnap ? 'preferred_countries' and buyer.preferred_countries is distinct from oldsnap->>'preferred_countries')
    or (not(oldsnap ? 'preferred_countries') and nullif(buyer.preferred_countries,'') is not null);
   manual_budget:=coalesce(oldsnap->'max_budget_manual'='true'::jsonb,false)
    or (oldsnap ? 'max_budget' and buyer.max_budget is distinct from site_private.draft_number(oldsnap->'max_budget'))
    or (not(oldsnap ? 'max_budget') and buyer.max_budget is not null);
   update public.investors i set
    max_budget=case when not manual_budget and budget is not null then budget else i.max_budget end,
    preferred_countries=case when not manual_interest then interest else i.preferred_countries end
    where i.id=entity;
   select site_private.safe_json(criteria_json) into c from public.investors where id=entity;
   -- Do not refresh checked_at, verification flags, source checks, notes or manual country/seat.
   -- A source fetch is not a new human verification.
   for typ in select k from jsonb_object_keys(previous||incoming) as k loop
    if previous ? typ and (c->typ is distinct from previous->typ) and not(protected ? typ) then protected:=protected||jsonb_build_array(typ); end if;
    if protected ? typ then continue; end if;
    if incoming ? typ and (not(c ? typ) and not(previous ? typ) or (previous ? typ and c->typ=previous->typ)) then
     c:=c||jsonb_build_object(typ,incoming->typ);
    elsif incoming ? typ and not(previous ? typ) and c ? typ then
     -- Existing values without source provenance, including []/null/false, are manual until proved otherwise.
     protected:=protected||jsonb_build_array(typ);
    end if;
   end loop;
   if f->>'source_listing_state'='active' and site_private.safe_stamp(f->>'deadline')>now() and length(coalesce(f->>'reopen_evidence',''))>0
    and not(protected ? 'call_closed') and previous ? 'call_closed' and c->'call_closed'=previous->'call_closed' then c:=c-'call_closed'; end if;
   update public.investors set criteria_json=c::text where id=entity and criteria_json is distinct from c::text;
  end if;
  update public.source_candidates set investor_id=entity where id=cid and investor_id is distinct from entity;
  -- Applied values track only source-owned keys, not a copy of every manual criterion.
  incoming:=coalesce(previous,'{}'::jsonb)||incoming;
  if not(c ? 'call_closed') then incoming:=incoming-'call_closed'; end if;
  snap:=jsonb_build_object('max_budget',case when manual_budget then oldsnap->'max_budget' else coalesce(to_jsonb(budget),oldsnap->'max_budget','null'::jsonb) end,'criteria',site_private.source_buyer_criteria(f),'applied_criteria',incoming,'protected_criteria',protected,
   'preferred_countries',interest,'preferred_countries_manual',manual_interest,'max_budget_manual',manual_budget);
 end if;
 update site_private.listing_lifecycle set snapshot=snap where candidate_id=cid;
 update site_private.listing_lifecycle set state='observed',checked_at=site_private.safe_stamp(r.last_seen),first_missing_at=null,missing_count=0,reason=null where candidate_id=cid and site_private.safe_stamp(r.last_seen)>checked_at and (state not in ('expired','removed') or (f->>'source_listing_state'='active' and site_private.safe_stamp(f->>'deadline')>now() and length(coalesce(f->>'reopen_evidence',''))>0));
 stamp:=site_private.safe_stamp(f->>'deadline');
 if stamp is not null and stamp<=now() then update site_private.listing_lifecycle set state='expired',reason='Istekao dokumentirani rok izvornog oglasa',evidence_url=r.url,checked_at=now() where candidate_id=cid; end if;
 if f->>'source_listing_state' in ('removed','expired') and length(coalesce(f->>'source_status_evidence',''))>0 then update site_private.listing_lifecycle set state=f->>'source_listing_state',reason=f->>'source_status_evidence',checked_at=site_private.safe_stamp(r.last_seen),evidence_url=r.url where candidate_id=cid; end if;
 return 'synced';
end $function$;



revoke all on function site_private.source_country_name(text),site_private.source_buyer_criteria(jsonb),site_private.source_buyer_interest(jsonb,text) from public,anon,authenticated;
