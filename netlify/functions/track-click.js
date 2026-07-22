const crypto = require("crypto");
const { getClient, TABLES } = require("./_lib/supabase");
const { LINK_IDS, cleanString } = require("./_lib/validate");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

// Public, no passcode — records that one of our own instrumented links was
// clicked. No IP address, device info, or visitor identifier is stored,
// only which link and when. `linkId` must be one of the ids we defined
// ourselves (LINK_IDS) so this can't be used to log arbitrary junk.
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

  const linkId = cleanString(body.linkId, 100);
  if (!LINK_IDS.includes(linkId)) {
    return respond(400, { error: "Unknown link id." });
  }
  const page = cleanString(body.page, 200);

  const client = getClient();
  const { error: insertError } = await client.from(TABLES.linkClicks).insert({
    id: crypto.randomUUID(),
    link_id: linkId,
    page: page || null
  });

  if (insertError) {
    console.error("track-click: Supabase insert into " + TABLES.linkClicks + " failed:", insertError);
    return respond(502, { error: "Couldn't record that." });
  }

  return respond(201, { ok: true });
};
