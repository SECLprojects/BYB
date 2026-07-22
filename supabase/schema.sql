-- Bring Your Bills — Supabase schema for the event-request/approval workflow.
--
-- Run this once in your Supabase project's SQL editor (Database -> SQL
-- Editor -> New query), then paste the whole file and click Run.
--
-- Tables are prefixed with byb_ so they can't collide with anything else
-- in a shared/existing Supabase project.
--
-- Nothing here creates a public/anon policy. Row Level Security is enabled
-- with no policies attached, so the anon/public API key cannot read or
-- write these tables at all. Only the service role key — used solely
-- inside Netlify Functions, never sent to a browser — can touch them.
-- That's what keeps submitter names/emails off the public internet.

create extension if not exists pgcrypto;

create table if not exists byb_event_requests (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('add', 'edit', 'delete', 'attend')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  name text not null,
  organisation text not null,
  email text not null,
  note text,
  target_id text,
  event jsonb,
  result_event_id text
);

create index if not exists byb_event_requests_status_idx on byb_event_requests (status);
create index if not exists byb_event_requests_submitted_at_idx on byb_event_requests (submitted_at desc);

alter table byb_event_requests enable row level security;

-- A running, deduplicated contact list — every submission updates the
-- matching row (by email) rather than piling up duplicates. Browsable
-- directly in Supabase's Table editor.
create table if not exists byb_contacts (
  email text primary key,
  name text not null,
  organisation text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  request_count integer not null default 1
);

alter table byb_contacts enable row level security;

create or replace function byb_upsert_contact(p_email text, p_name text, p_organisation text)
returns void as $$
begin
  insert into byb_contacts (email, name, organisation, first_seen_at, last_seen_at, request_count)
  values (p_email, p_name, p_organisation, now(), now(), 1)
  on conflict (email) do update set
    name = excluded.name,
    organisation = excluded.organisation,
    last_seen_at = now(),
    request_count = byb_contacts.request_count + 1;
end;
$$ language plpgsql security definer;

-- Public "let us know you're coming" registrations — open to anyone, no
-- passcode. Purely optional (walk-ins are always welcome regardless) and
-- used only for SECL's own event planning (headcount, interpreter
-- staffing). Never shown publicly. Individual community members' data is
-- more sensitive than the partner-organisation data above, so keep this
-- to the minimum useful fields — no open-ended "describe your situation"
-- text field by design.
create table if not exists byb_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  submitted_at timestamptz not null default now(),
  name text,
  contact text,
  party_size integer not null default 1,
  bill_categories text[] not null default '{}',
  needs_interpreter boolean not null default false,
  interpreter_language text
);

-- Added after initial launch: separate phone/email fields plus an explicit
-- consent flag for future contact, replacing the single free-text `contact`
-- column (kept, but no longer written to, for any pre-existing rows).
-- `add column if not exists` makes this safe to re-run on an already-live
-- table.
alter table byb_event_registrations add column if not exists phone text;
alter table byb_event_registrations add column if not exists email text;
alter table byb_event_registrations add column if not exists contact_consent boolean not null default false;

create index if not exists byb_event_registrations_event_id_idx on byb_event_registrations (event_id);

alter table byb_event_registrations enable row level security;

-- Self-hosted, cookieless click tracking — records which link was clicked
-- and when, nothing else (no IP, no device/browser fingerprint, no visitor
-- identifier). Only for the specific links we deliberately instrument
-- (see LINK_IDS in netlify/functions/_lib/validate.js), not general page
-- analytics.
create table if not exists byb_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id text not null,
  page text,
  clicked_at timestamptz not null default now()
);

create index if not exists byb_link_clicks_link_id_idx on byb_link_clicks (link_id);
create index if not exists byb_link_clicks_clicked_at_idx on byb_link_clicks (clicked_at desc);

alter table byb_link_clicks enable row level security;

-- Pre-aggregated counts so the staff view doesn't need to pull every raw
-- click row as traffic grows.
create or replace view byb_link_click_counts as
  select link_id, count(*) as total_clicks, max(clicked_at) as last_clicked_at
  from byb_link_clicks
  group by link_id;
