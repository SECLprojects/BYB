const { schedule } = require("@netlify/functions");
const { getClient, TABLES } = require("./_lib/supabase");

const RETENTION_YEARS = 5;

// Deletes personal information older than the retention period rather than
// keeping it indefinitely. byb_link_clicks is excluded — it holds no
// personal information (just a link id and a timestamp).
//
// Wrapped in Netlify's schedule() helper so it runs ONLY on the cron
// schedule and is not invocable over public HTTP (a direct request to a
// scheduled function is rejected by Netlify), closing off an anonymous
// caller triggering the deletes. Even if triggered, it can only ever
// remove data already past its retention deadline — never recent records.
async function purge() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  const cutoffIso = cutoff.toISOString();

  const client = getClient();
  const results = {};

  for (const [label, table, column] of [
    ["requests", TABLES.requests, "submitted_at"],
    ["registrations", TABLES.registrations, "submitted_at"],
    ["contacts", TABLES.contacts, "last_seen_at"]
  ]) {
    const { error, count } = await client
      .from(table)
      .delete({ count: "exact" })
      .lt(column, cutoffIso);

    if (error) {
      console.error("purge-old-data: delete on " + table + " failed:", error);
      results[label] = { error: error.message };
    } else {
      results[label] = { deleted: count || 0 };
    }
  }

  console.log("purge-old-data: cutoff=" + cutoffIso, JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ cutoff: cutoffIso, results }) };
}

exports.handler = schedule("@monthly", purge);
