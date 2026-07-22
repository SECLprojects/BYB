const { getClient, TABLES } = require("./_lib/supabase");

const RETENTION_YEARS = 5;

// Netlify Scheduled Function (see the [functions."purge-old-data"] schedule
// entry in netlify.toml) — runs monthly with no input, deleting personal
// information older than the retention period rather than keeping it
// indefinitely. Nothing here is reachable with useful parameters even if
// called directly: it always just deletes whatever has already crossed the
// retention cutoff, which is safe regardless of who/what triggers it.
//
// byb_link_clicks isn't included here — it holds no personal information
// (just a link id and a timestamp), so it isn't subject to the same
// retention obligation. It can be pruned separately for storage hygiene if
// that ever becomes worth doing.
exports.handler = async function () {
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
};
