-- Partner agency proposals (plan #46 addendum, module 7): internal staging only. Additive and repeatable; nothing
-- here is reachable without the owner gateway, and no external form or endpoint exists. Rollback: the tables can be
-- left in place unused; dropping them is a separate, explicit decision.
create table if not exists site_private.partner_grants(
 id bigserial primary key,
 agency_source_id bigint not null,
 record_ids bigint[] not null,
 fields text[] not null,
 -- SHA-256 of the access token; the token itself is generated and shown on the operator's side and never stored.
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_by text not null,
 check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
 check (cardinality(record_ids) between 1 and 200 and cardinality(fields) between 1 and 40)
);
create table if not exists site_private.partner_proposals(
 id bigserial primary key,
 grant_id bigint not null references site_private.partner_grants(id),
 property_id bigint not null,
 field text not null,
 value_json jsonb not null,
 value_digest text not null,
 -- The field's exact stored value when the proposal was staged; acceptance requires it to be unchanged.
 base_value text not null,
 evidence text not null,
 author text not null,
 status text not null default 'novo' check (status in ('novo','prihvaćeno','odbijeno','zastarjelo')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by text,
 decision_note text
);
-- The same open proposal cannot be staged twice (replays and double submits).
create unique index if not exists partner_proposals_open_once on site_private.partner_proposals(grant_id,property_id,field,value_digest) where status='novo';
create index if not exists partner_proposals_status on site_private.partner_proposals(status,created_at);
-- Append-only audit of every staging and decision.
create table if not exists site_private.partner_audit(
 id bigserial primary key,
 proposal_id bigint,
 grant_id bigint,
 event text not null,
 detail jsonb not null default '{}'::jsonb,
 recorded_at timestamptz not null default now()
);
alter table site_private.partner_grants enable row level security;
alter table site_private.partner_proposals enable row level security;
alter table site_private.partner_audit enable row level security;
revoke all on site_private.partner_grants,site_private.partner_proposals,site_private.partner_audit from public,anon,authenticated;
create or replace function site_private.partner_audit_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'partner_audit is append-only'; end $$;
drop trigger if exists partner_audit_no_change on site_private.partner_audit;
create trigger partner_audit_no_change before update or delete on site_private.partner_audit for each row execute function site_private.partner_audit_append_only();
