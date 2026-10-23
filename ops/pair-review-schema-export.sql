-- READ-ONLY export of the real pair-review schema, needed before any pair API or migration.
-- Run in the Supabase SQL editor (or psql) and add the output to the repository, like the
-- Sites source in sites-review/. Changes nothing: the transaction is read only and rolled back.
begin transaction read only;

-- 1. Columns of every table that touches pairs, reviews, history and contact preparation.
select table_schema,table_name,ordinal_position,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema in ('public','site_private')
  and table_name in ('match_results','match_review_tasks','excluded_match_history','activity','notification_outbox',
                     'investors','properties','source_candidates','listing_lifecycle')
order by table_schema,table_name,ordinal_position;

-- 2. Keys, foreign keys and checks (which deletes cascade into review data).
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace in ('public'::regnamespace,'site_private'::regnamespace)
  and conrelid::regclass::text ~ '(match_results|match_review_tasks|excluded_match_history|activity|notification_outbox)'
order by 1,2;

-- 3. Triggers on those tables (e.g. verified_pairs_only).
select tgrelid::regclass as table_name,tgname,pg_get_triggerdef(oid) as definition
from pg_trigger
where not tgisinternal
  and tgrelid::regclass::text ~ '(match_results|match_review_tasks|excluded_match_history|activity|notification_outbox|investors|properties)'
order by 1,2;

-- 4. Full source of the directly applied functions named in issue #1 and of related guards.
select n.nspname,p.oid::regprocedure as signature,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','site_private')
  and (p.proname ~ '(match_review|review_task|fill_property_type|fill_investor_criteria|sync_source_listing|reconcile_listing_lifecycle|safe_json|safe_stamp|title_property_type|guard_verified|property_eligible|investor_eligible)')
order by 1,2;

-- 5. Row-level security and grants (the pair API must stay server-side only).
select schemaname,tablename,rowsecurity from pg_tables
where schemaname in ('public','site_private') and tablename ~ '(match_|review|activity|notification|excluded)';
select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema in ('public','site_private') and table_name ~ '(match_|review|activity|notification|excluded)'
order by 1,2,3,4;

-- 6. Sizes only (no personal data).
select 'match_results' as name,count(*) from public.match_results
union all select 'excluded_match_history',count(*) from site_private.excluded_match_history
union all select 'activity',count(*) from public.activity;

rollback;
