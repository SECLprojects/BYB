const { getClient, rowToClickCount, TABLES } = require("./_lib/supabase");
const { passcodeMatches } = require("./_lib/auth");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return respond(400, { error: "Invalid JSON." });
  }

  if (!passcodeMatches(body.passcode, process.env.STAFF_PASSCODE)) {
    return respond(401, { error: "That staff passcode isn't recognised." });
  }

  const client = getClient();
  const { data, error } = await client.from(TABLES.linkClickCounts).select("*");

  if (error) {
    console.error("list-click-stats: Supabase select on " + TABLES.linkClickCounts + " failed:", error);
    return respond(502, { error: "Couldn't load click stats right now. Please try again shortly." });
  }

  return respond(200, { stats: data.map(rowToClickCount) });
};
