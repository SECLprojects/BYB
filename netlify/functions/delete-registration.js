const { getClient, TABLES } = require("./_lib/supabase");
const { passcodeMatches } = require("./_lib/auth");
const { cleanString } = require("./_lib/validate");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

// Staff-only — lets SECL act on a correction/deletion/consent-withdrawal
// request for a specific registration without needing direct Supabase
// access.
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

  const id = cleanString(body.id, 200);
  if (!id) {
    return respond(400, { error: "A registration id is required." });
  }

  const client = getClient();
  const { error } = await client.from(TABLES.registrations).delete().eq("id", id);

  if (error) {
    console.error("delete-registration: Supabase delete on " + TABLES.registrations + " failed:", error);
    return respond(502, { error: "Couldn't delete that registration right now. Please try again shortly." });
  }

  return respond(200, { ok: true });
};
