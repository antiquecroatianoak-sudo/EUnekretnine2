-- facts-v1 (plan #46 addendum, module 1): specialised property facts as validated JSON text.
-- Additive and repeatable: no existing column, row or manual value changes; readers treat NULL as "no facts".
-- Rollback: the application ignores the column when absent; dropping it is a separate, explicit decision.
alter table public.properties add column if not exists facts_json text;
comment on column public.properties.facts_json is 'facts-v1: {key:{value,unit,origin,status,evidence,observed_on,valid_until}}; validated by facts.mjs, NULL = no facts';
