
create or replace function site_private.guard_verified_notification() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='Spremno' and not exists(
 select 1 from public.match_results m join public.properties p on p.id=m.property_id join public.investors i on i.id=m.investor_id
 where m.property_id=new.property_id and site_private.property_eligible(p) and site_private.investor_eligible(i)
 and m.result_json::jsonb->>'status'='Podudaranje kriterija'
 ) then new.status:='Potrebna ponovna provjera'; end if;
 return new;
end $$;
revoke all on function site_private.guard_verified_notification() from public,anon,authenticated;
drop trigger if exists verified_notifications_only on public.notification_outbox;
create trigger verified_notifications_only before insert or update on public.notification_outbox for each row execute function site_private.guard_verified_notification();
alter table site_private.excluded_match_history enable row level security;
