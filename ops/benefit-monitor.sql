-- Read-only baseline. Counts are operational indicators, not measured precision.
select now() as measured_at,
 (select count(*) from public.match_results) as pair_count,
 (select count(*) from public.match_results where result_json::jsonb->>'status'='Podudaranje kriterija') as match_count,
 (select count(*) from public.match_results where result_json::jsonb->>'status'='Kandidat - potrebna provjera') as candidate_count,
 (select round(avg(jsonb_array_length(coalesce(result_json::jsonb->'missing','[]'::jsonb))),2) from public.match_results) as average_open_items,
 (select count(*) from site_private.match_review_tasks where status not in ('Provjereno','Više nije navedeno kao nedostatak')) as open_review_tasks,
 (select count(*) from site_private.pair_history where recorded_at>=now()-interval '24 hours') as pair_events_last_24h,
 (select max(last_evaluated_at) from site_private.pair_records where in_latest_calculation) as last_pair_evaluation;
