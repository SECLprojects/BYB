const { createClient } = require("@supabase/supabase-js");

// Prefixed so these can't collide with anything else in a shared/existing
// Supabase project. Keep in sync with supabase/schema.sql.
const TABLES = { requests: "byb_event_requests", contacts: "byb_contacts" };
const RPC_UPSERT_CONTACT = "byb_upsert_contact";

let cachedClient;

// Uses the service role key deliberately — it bypasses Row Level Security,
// which is fine because this key only ever runs inside a Netlify Function
// (server-side), never in the browser. RLS is enabled on both tables with
// no public policies, so nothing but this key can read or write them.
function getClient() {
  if (!cachedClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.");
    }
    cachedClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return cachedClient;
}

// Maps a Postgres row (snake_case) to the camelCase shape the rest of the
// codebase (review.js, decide-request's applyDecision) already expects.
function rowToRecord(row) {
  return {
    id: row.id,
    action: row.action,
    status: row.status,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at || undefined,
    name: row.name,
    organisation: row.organisation,
    email: row.email,
    note: row.note || "",
    targetId: row.target_id || undefined,
    event: row.event || undefined,
    resultEventId: row.result_event_id || undefined
  };
}

module.exports = { getClient, rowToRecord, TABLES, RPC_UPSERT_CONTACT };
