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
