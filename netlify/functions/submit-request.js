const crypto = require("crypto");
const { getClient, TABLES, RPC_UPSERT_CONTACT } = require("./_lib/supabase");
const { passcodeMatches } = require("./_lib/auth");
const {
  ACTIONS,
  isValidEmail,
  cleanString,
  validateEventFields
} = require("./_lib/validate");

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

  if (!passcodeMatches(body.passcode, process.env.PARTNER_PASSCODE)) {
    return respond(401, { error: "That passcode isn't recognised." });
  }

  const action = body.action;
  if (!ACTIONS.includes(action)) {
    return respond(400, { error: "Action must be one of: " + ACTIONS.join(", ") + "." });
  }

  const name = cleanString(body.name, 200);
  const organisation = cleanString(body.organisation, 200);
  const email = cleanString(body.email, 200);
  const note = cleanString(body.note, 2000);

  const errors = [];
  if (!name) errors.push("Your name is required.");
  if (!organisation) errors.push("Your organisation is required.");
  if (!isValidEmail(email)) errors.push("A valid contact email is required.");

  const record = {
    id: crypto.randomUUID(),
    action: action,
    status: "pending",
    submittedAt: new Date().toISOString(),
    name: name,
    organisation: organisation,
    email: email,
    note: note
  };

  if (action === "add") {
    const fieldErrors = validateEventFields(body.event);
    errors.push.apply(errors, fieldErrors);
    record.event = {
      date: body.event && body.event.date,
      title: cleanString(body.event && body.event.title, 200),
      venue: cleanString(body.event && body.event.venue, 200),
      region: body.event && body.event.region,
      status: (body.event && body.event.status) || undefined,
      host: cleanString(body.event && body.event.host, 200),
      time: cleanString(body.event && body.event.time, 100)
    };
  } else if (action === "edit") {
    if (!cleanString(body.targetId, 200)) errors.push("Choose which event you're editing.");
    const fieldErrors = validateEventFields(body.event);
    errors.push.apply(errors, fieldErrors);
    record.targetId = cleanString(body.targetId, 200);
    record.event = {
      date: body.event && body.event.date,
      title: cleanString(body.event && body.event.title, 200),
      venue: cleanString(body.event && body.event.venue, 200),
      region: body.event && body.event.region,
      status: (body.event && body.event.status) || undefined,
      host: cleanString(body.event && body.event.host, 200),
      time: cleanString(body.event && body.event.time, 100)
    };
  } else if (action === "delete") {
    if (!cleanString(body.targetId, 200)) errors.push("Choose which event you're removing.");
    record.targetId = cleanString(body.targetId, 200);
  } else if (action === "attend") {
    if (!cleanString(body.targetId, 200)) errors.push("Choose which event you're confirming attendance at.");
    record.targetId = cleanString(body.targetId, 200);
  }

  if (errors.length) {
    return respond(400, { error: errors.join(" ") });
  }

  const client = getClient();

  const { error: insertError } = await client.from(TABLES.requests).insert({
    id: record.id,
    action: record.action,
    status: "pending",
    submitted_at: record.submittedAt,
    name: record.name,
    organisation: record.organisation,
    email: record.email,
    note: record.note || null,
    target_id: record.targetId || null,
    event: record.event || null
  });

  if (insertError) {
    return respond(502, { error: "Couldn't save your request right now. Please try again shortly." });
  }

  // Best-effort — a contacts upsert failing shouldn't fail the submission.
  await client
    .rpc(RPC_UPSERT_CONTACT, { p_email: record.email, p_name: record.name, p_organisation: record.organisation })
    .then(function () {}, function () {});

  return respond(201, { id: record.id });
};
