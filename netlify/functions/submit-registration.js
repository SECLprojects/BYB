const crypto = require("crypto");
const { getClient, TABLES } = require("./_lib/supabase");
const { BILL_CATEGORIES, cleanString } = require("./_lib/validate");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

// Public — anyone can submit this, no passcode. Registering is always
// optional (walk-ins are welcome regardless); this only ever feeds
// SECL's own private event planning, never anything public-facing.
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

  // Honeypot: a hidden field real people never fill in. Bots that fill
  // every field on a form will fill this too — pretend to succeed so we
  // don't tip them off, but skip the actual write.
  if (cleanString(body.website, 200)) {
    return respond(201, { ok: true });
  }

  const eventId = cleanString(body.eventId, 200);
  if (!eventId) {
    return respond(400, { error: "Choose which event you're coming to." });
  }

  const errors = [];

  let partySize = parseInt(body.partySize, 10);
  if (!Number.isFinite(partySize) || partySize < 1) partySize = 1;
  if (partySize > 20) errors.push("For groups larger than 20, please contact us directly at byb@secl.org.au.");

  const billCategories = Array.isArray(body.billCategories)
    ? Array.from(new Set(body.billCategories.filter((c) => BILL_CATEGORIES.includes(c))))
    : [];

  const needsInterpreter = body.needsInterpreter === true;
  const interpreterLanguage = needsInterpreter ? cleanString(body.interpreterLanguage, 100) : "";

  if (errors.length) {
    return respond(400, { error: errors.join(" ") });
  }

  const client = getClient();
  const { error: insertError } = await client.from(TABLES.registrations).insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    name: cleanString(body.name, 200) || null,
    contact: cleanString(body.contact, 200) || null,
    party_size: partySize,
    bill_categories: billCategories,
    needs_interpreter: needsInterpreter,
    interpreter_language: interpreterLanguage || null
  });

  if (insertError) {
    return respond(502, { error: "Couldn't save that right now. Please try again shortly." });
  }

  return respond(201, { ok: true });
};
