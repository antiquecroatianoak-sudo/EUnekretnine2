-- Permanent record of potential pairs (owner goal 6342865014, audit 6342938279 points 3 and 4).
-- Built on the real schema in ops/pair-review-schema-2026-10-22.json. Additive and repeatable:
-- new site_private tables, three new columns on match_review_tasks, new triggers. Existing rows,
-- match_results, its guards and the cascade from match_results to match_review_tasks stay as they are.
-- Two existing functions are replaced in place with the same signature:
--  * sync_match_review_tasks keeps manual statuses instead of resetting every task to 'Otvoreno';
--  * investor_eligible no longer requires a budget (owner correction 6344490047/6344511552).
-- Nothing here sends a message or contacts anyone. Apply only after independent review.
begin;

-- One row per pair ever computed. Recalculation updates it; a pair that drops out is marked, not erased.
create table if not exists site_private.pair_records(
 property_id integer not null,
 investor_id integer not null,
 first_seen_at timestamptz not null default now(),
 last_evaluated_at timestamptz not null default now(),
 status text not null,
 phase text,
 result_json jsonb not null,
 in_latest_calculation boolean not null default true,
 left_at timestamptz,
 left_reason text,
 primary key(property_id,investor_id)
);
-- Append-only history of status, phase and open items per pair.
create table if not exists site_private.pair_history(
 id bigserial primary key,
 property_id integer not null,
 investor_id integer not null,
 recorded_at timestamptz not null default now(),
 event text not null,
 status text,
 phase text,
 missing jsonb,
 rejected jsonb
);
create index if not exists pair_history_pair on site_private.pair_history(property_id,investor_id,recorded_at);
-- Question drafts and answers per pair and open item. A draft is never sent from the system.
-- Only a 'Provjereno' answer with evidence, source and date can close a pair-specific item.
create table if not exists site_private.pair_answers(
 id bigserial primary key,
 property_id integer not null,
 investor_id integer not null,
 requirement text not null check(length(requirement) between 1 and 500),
 kind text not null check(kind in ('Nacrt pitanja','Odgovor')),
 addressed_to text check(addressed_to in ('Prodavatelj','Kupac','Interni izvor')),
 body text not null check(length(trim(body)) between 1 and 8000),
 evidence text check(length(evidence)<=2000),
 source text check(length(source)<=2000),
 channel text check(length(channel)<=200),
 answered_on date,
 status text not null check(status in ('Nacrt','Zaprimljeno - nije provjereno','Provjereno','Odbačeno')),
 digest text check(digest ~ '^[0-9a-f]{8}$'),
 recorded_by text not null,
 recorded_at timestamptz not null default now(),
 check(kind<>'Nacrt pitanja' or status='Nacrt'),
 check(status<>'Provjereno' or (nullif(trim(evidence),'') is not null and nullif(trim(source),'') is not null and answered_on is not null))
);
alter table site_private.pair_answers add column if not exists outcome text not null default 'nepoznato' check(outcome in ('zadovoljava','ne zadovoljava','nepoznato'));
create index if not exists pair_answers_pair on site_private.pair_answers(property_id,investor_id,requirement,recorded_at);
-- Confirmed interest and a closed deal are separate stages with their own evidence; matching never sets them.
create table if not exists site_private.pair_stages(
 id bigserial primary key,
 property_id integer not null,
 investor_id integer not null,
 stage text not null check(stage in ('Potvrđen interes','Interes povučen','Realiziran posao')),
 evidence text not null check(length(trim(evidence)) between 1 and 2000),
 source text not null check(length(trim(source)) between 1 and 2000),
 stage_on date not null,
 recorded_by text not null,
 recorded_at timestamptz not null default now()
);
create index if not exists pair_stages_pair on site_private.pair_stages(property_id,investor_id,recorded_at);
-- Review tasks of a pair that left the latest calculation; restored when the pair returns.
create table if not exists site_private.pair_task_archive(
 property_id integer not null,
 investor_id integer not null,
 requirement text not null,
 status text not null,
 verification_method text not null,
 property_source text,
 investor_source text,
 updated_at timestamptz not null,
 status_reason text,
 checked_at timestamptz,
 evidence text,
 archived_at timestamptz not null default now(),
 primary key(property_id,investor_id,requirement)
);
alter table site_private.match_review_tasks add column if not exists status_reason text;
alter table site_private.match_review_tasks add column if not exists checked_at timestamptz;
alter table site_private.match_review_tasks add column if not exists evidence text;

alter table site_private.pair_records enable row level security;
alter table site_private.pair_history enable row level security;
alter table site_private.pair_answers enable row level security;
alter table site_private.pair_stages enable row level security;
alter table site_private.pair_task_archive enable row level security;
do $$
declare r text; t text;
begin
 for r in select rolname from pg_roles where rolname in ('anon','authenticated') loop
  foreach t in array array['pair_records','pair_history','pair_answers','pair_stages','pair_task_archive'] loop
   execute format('revoke all on site_private.%I from %I',t,r);
  end loop;
 end loop;
end $$;

-- Keeps pair_records and pair_history in step with every accepted write to match_results.
create or replace function site_private.record_pair()
 returns trigger language plpgsql set search_path to '' as $function$
declare r jsonb:=new.result_json::jsonb; old_record site_private.pair_records;
begin
 select * into old_record from site_private.pair_records where property_id=new.property_id and investor_id=new.investor_id;
 insert into site_private.pair_records(property_id,investor_id,status,phase,result_json)
 values(new.property_id,new.investor_id,r->>'status',r->>'phase',r)
 on conflict(property_id,investor_id) do update set last_evaluated_at=now(),status=excluded.status,phase=excluded.phase,
  result_json=excluded.result_json,in_latest_calculation=true,left_at=null,left_reason=null;
 if old_record.property_id is null or not old_record.in_latest_calculation or old_record.status is distinct from r->>'status'
  or old_record.phase is distinct from r->>'phase' or old_record.result_json->'missing' is distinct from r->'missing'
  or old_record.result_json->'rejected' is distinct from r->'rejected' then
  insert into site_private.pair_history(property_id,investor_id,event,status,phase,missing,rejected)
  values(new.property_id,new.investor_id,case when old_record.property_id is null then 'Prvi izračun' when not old_record.in_latest_calculation then 'Ponovno u izračunu' else 'Promjena rezultata' end,
   r->>'status',r->>'phase',r->'missing',r->'rejected');
 end if;
 -- Tasks of a returning pair come back with their manual statuses before sync_match_review_tasks runs.
 insert into site_private.match_review_tasks(property_id,investor_id,requirement,status,verification_method,property_source,investor_source,updated_at,status_reason,checked_at,evidence)
 select property_id,investor_id,requirement,status,verification_method,property_source,investor_source,updated_at,status_reason,checked_at,evidence
 from site_private.pair_task_archive where property_id=new.property_id and investor_id=new.investor_id
 on conflict(property_id,investor_id,requirement) do nothing;
 delete from site_private.pair_task_archive where property_id=new.property_id and investor_id=new.investor_id;
 return new;
end $function$;

-- Before the cascade removes review tasks, keep them and mark the pair as no longer computed.
create or replace function site_private.archive_pair()
 returns trigger language plpgsql set search_path to '' as $function$
begin
 insert into site_private.pair_task_archive(property_id,investor_id,requirement,status,verification_method,property_source,investor_source,updated_at,status_reason,checked_at,evidence)
 select property_id,investor_id,requirement,status,verification_method,property_source,investor_source,updated_at,status_reason,checked_at,evidence
 from site_private.match_review_tasks where property_id=old.property_id and investor_id=old.investor_id
 on conflict(property_id,investor_id,requirement) do update set status=excluded.status,verification_method=excluded.verification_method,
  property_source=excluded.property_source,investor_source=excluded.investor_source,updated_at=excluded.updated_at,
  status_reason=excluded.status_reason,checked_at=excluded.checked_at,evidence=excluded.evidence,archived_at=now();
 update site_private.pair_records set in_latest_calculation=false,left_at=now(),left_reason='Nije u zadnjem izračunu (ne odgovara, nedostaje izvor ili je zapis isključen)'
 where property_id=old.property_id and investor_id=old.investor_id and in_latest_calculation;
 if found then
  insert into site_private.pair_history(property_id,investor_id,event,status,phase,missing,rejected)
  select property_id,investor_id,'Izostao iz zadnjeg izračuna',status,phase,result_json->'missing',result_json->'rejected'
  from site_private.pair_records where property_id=old.property_id and investor_id=old.investor_id;
 end if;
 return old;
end $function$;

drop trigger if exists pair_records_after_write on public.match_results;
create trigger pair_records_after_write after insert or update on public.match_results
 for each row execute function site_private.record_pair();
drop trigger if exists pair_records_before_delete on public.match_results;
create trigger pair_records_before_delete before delete on public.match_results
 for each row execute function site_private.archive_pair();

-- Interest needs a current real opportunity; a deal needs recorded interest that was not withdrawn.
create or replace function site_private.guard_pair_stage()
 returns trigger language plpgsql set search_path to '' as $function$
declare last_interest text;
begin
 if new.stage='Potvrđen interes' and not exists(select 1 from public.match_results m where m.property_id=new.property_id and m.investor_id=new.investor_id
   and m.result_json::jsonb->>'status'='Podudaranje kriterija') then
  raise exception 'Potvrđen interes moguć je samo za stvarnu priliku (sve provjere zatvorene).';
 end if;
 select stage into last_interest from site_private.pair_stages where property_id=new.property_id and investor_id=new.investor_id
  and stage in ('Potvrđen interes','Interes povučen') order by recorded_at desc,id desc limit 1;
 if new.stage='Realiziran posao' and last_interest is distinct from 'Potvrđen interes' then
  raise exception 'Realizacija zahtijeva prethodno zabilježen i nepovučen potvrđen interes.';
 end if;
 if new.stage='Interes povučen' and last_interest is distinct from 'Potvrđen interes' then
  raise exception 'Nema potvrđenog interesa koji bi se povukao.';
 end if;
 return new;
end $function$;
drop trigger if exists guard_pair_stage_before_insert on site_private.pair_stages;
create trigger guard_pair_stage_before_insert before insert on site_private.pair_stages
 for each row execute function site_private.guard_pair_stage();
-- Answers and stages are an evidence log: corrections are new rows, never edits.
create or replace function site_private.append_only()
 returns trigger language plpgsql set search_path to '' as $function$
begin raise exception 'Zapis dokaza se ne mijenja; dodaj novi zapis.'; end $function$;
drop trigger if exists pair_answers_append_only on site_private.pair_answers;
create trigger pair_answers_append_only before update or delete on site_private.pair_answers
 for each row execute function site_private.append_only();
drop trigger if exists pair_stages_append_only on site_private.pair_stages;
create trigger pair_stages_append_only before update or delete on site_private.pair_stages
 for each row execute function site_private.append_only();

-- Same signature and task methods as the exported function. Differences:
--  * a re-upsert keeps 'U provjeri' (and any other manual status) instead of resetting to 'Otvoreno';
--  * 'Provjereno' that is still reported missing is reopened with the documented reason;
--  * an item that left the missing list keeps 'Provjereno' rather than being relabelled.
create or replace function site_private.sync_match_review_tasks()
 returns trigger language plpgsql set search_path to '' as $function$
declare label text; purl text; iurl text; method text;
begin
select source into purl from public.properties where id=new.property_id;
select coalesce(site_private.safe_json(criteria_json)->>'source_url',site_private.safe_json(criteria_json)->>'evidence_url',site_private.safe_json(notes)->>'official_url') into iurl from public.investors where id=new.investor_id;
update site_private.match_review_tasks set status='Više nije navedeno kao nedostatak',status_reason=null,updated_at=now()
where property_id=new.property_id and investor_id=new.investor_id and status not in ('Provjereno','Više nije navedeno kao nedostatak')
and not (coalesce(new.result_json::jsonb->'missing','[]'::jsonb) ? requirement);
for label in select jsonb_array_elements_text(coalesce(new.result_json::jsonb->'missing','[]'::jsonb)) loop
method:=case
when label ilike '%budžet%' then 'Izvor cijene i troškova; budžet i interes zahtijevaju dokaz kupca. Bez automatskog kontaktiranja.'
when label ilike '%pravne%' then 'Zemljišne knjige, dokumentacija i stručna pravna provjera.'
when label ilike '%gradnje%' then 'Službeni prostorni plan, identifikacija parcele i stručna urbanistička provjera.'
when label ilike '%kupca%' or label ilike '%napomena%' then 'Pregledati izvorne uvjete i napomene; nepotvrđeno ostaviti otvoreno.'
else 'Provjeriti pojedinačni izvorni oglas i dokumentirane podatke; ne nagađati.' end;
insert into site_private.match_review_tasks(property_id,investor_id,requirement,verification_method,property_source,investor_source)
values(new.property_id,new.investor_id,label,method,purl,iurl)
on conflict(property_id,investor_id,requirement) do update set
 status=case when match_review_tasks.status in ('Provjereno','Više nije navedeno kao nedostatak') then 'Otvoreno' else match_review_tasks.status end,
 status_reason=case when match_review_tasks.status='Provjereno' then 'Dokaz više ne vrijedi: promijenjeni su podaci nekretnine ili uvjet kupca, ili je istekao rok provjere.'
  when match_review_tasks.status='Više nije navedeno kao nedostatak' then 'Ponovno naveden kao nedostatak.' else match_review_tasks.status_reason end,
 verification_method=excluded.verification_method,property_source=excluded.property_source,investor_source=excluded.investor_source,updated_at=now();
end loop;
return new;
end $function$;

-- Same checks as the exported function except that the budget is optional; a known budget is still validated.
create or replace function site_private.investor_eligible(i public.investors)
 returns boolean language plpgsql stable set search_path to '' as $function$
declare c jsonb; checked timestamptz;
begin
 c:=i.criteria_json::jsonb;
 if i.verified is distinct from 1 or jsonb_typeof(c)<>'object' or c is null
 or nullif(trim(i.preferred_countries),'') is null
 or (i.min_budget is not null and (i.min_budget<0 or i.min_budget::text in ('NaN','Infinity','-Infinity')))
 or (i.max_budget is not null and (i.max_budget<=0 or i.max_budget::text in ('NaN','Infinity','-Infinity')))
 or (i.min_budget is not null and i.max_budget is not null and i.max_budget<i.min_budget)
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
end $function$;

-- Existing pairs start their permanent record now; nothing earlier is invented.
insert into site_private.pair_records(property_id,investor_id,status,phase,result_json)
select property_id,investor_id,result_json::jsonb->>'status',result_json::jsonb->>'phase',result_json::jsonb from public.match_results
on conflict do nothing;
insert into site_private.pair_history(property_id,investor_id,event,status,phase,missing,rejected)
select r.property_id,r.investor_id,'Početno stanje pri uvođenju evidencije',r.status,r.phase,r.result_json->'missing',r.result_json->'rejected'
from site_private.pair_records r where not exists(select 1 from site_private.pair_history h where h.property_id=r.property_id and h.investor_id=r.investor_id);

commit;
