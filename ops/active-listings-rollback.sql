-- Roll back enforcement without deleting any listing, history, evidence or column.
-- Execute transactionally if staged enforcement causes a regression.
drop trigger if exists active_property_candidates_only on public.source_candidates;
drop trigger if exists active_properties_only on public.properties;
create or replace function site_private.guard_pair_contacts()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.properties p cross join public.investors i
 where p.id=new.property_id and i.id=new.investor_id
 and site_private.contact_usable(p.contact_json,p.source)
 and site_private.contact_usable(i.contact_json,(i.criteria_json::jsonb)->>'source_url')) then return null;end if;
 return new;
exception when invalid_text_representation then return null;
end $$;
-- Redeploy the pre-change Edge Function versions as recorded in the checkpoint.
-- Keep activity_evidence and the private hash blocklist: additive data need not be destroyed.
