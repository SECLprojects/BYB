const crypto = require("crypto");
const { getClient, TABLES, RPC_UPSERT_CONTACT } = require("./_lib/supabase");
const { passcodeMatches } = require("./_lib/auth");
const { applyAndCommitToGitHub } = require("./_lib/apply-approval");
const { applyServiceAndCommitToGitHub } = require("./_lib/apply-service");
const {
  ACTIONS,
  isValidEmail,
  cleanString,
  validateEventFields,
  validateServiceFields
} = require("./_lib/validate");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

function buildEventFields(rawEvent) {
  return {
    date: rawEvent && rawEvent.date,
    title: cleanString(rawEvent && rawEvent.title, 200),
    venue: cleanString(rawEvent && rawEvent.venue, 200),
    address: cleanString(rawEvent && rawEvent.address, 200),
    region: rawEvent && rawEvent.region,
    status: (rawEvent && rawEvent.status) || undefined,
    host: cleanString(rawEvent && rawEvent.host, 200),
    time: cleanString(rawEvent && rawEvent.time, 100),
    eventType: (rawEvent && rawEvent.eventType) || undefined
  };
}

function buildServiceFields(rawService) {
  return {
    name: cleanString(rawService && rawService.name, 200),
    logoBase64: (rawService && rawService.logoBase64) || "",
    logoMimeType: (rawService && rawService.logoMimeType) || ""
  };
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

  // SECL's own passcode auto-applies instantly (no review.html step);
  // the shared partner passcode still queues for staff approval.
  const isSecl = passcodeMatches(body.passcode, process.env.SECL_PASSCODE);
  if (!isSecl && !passcodeMatches(body.passcode, process.env.PARTNER_PASSCODE)) {
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
    record.event = buildEventFields(body.event);
  } else if (action === "edit") {
    if (!cleanString(body.targetId, 200)) errors.push("Choose which event you're editing.");
    const fieldErrors = validateEventFields(body.event);
    errors.push.apply(errors, fieldErrors);
    record.targetId = cleanString(body.targetId, 200);
    record.event = buildEventFields(body.event);
  } else if (action === "delete") {
    if (!cleanString(body.targetId, 200)) errors.push("Choose which event you're removing.");
    record.targetId = cleanString(body.targetId, 200);
  } else if (action === "attend") {
    if (!cleanString(body.targetId, 200)) errors.push("Choose which event you're confirming attendance at.");
    record.targetId = cleanString(body.targetId, 200);
    const attendingService = cleanString(body.attendingService, 200);
    if (!attendingService) errors.push("Choose which service is attending.");
    // Reuses the generic `event` jsonb payload column (see add-service
    // above) rather than a dedicated one.
    record.event = { attendingService: attendingService };
  } else if (action === "add-service") {
    const fieldErrors = validateServiceFields(body.service);
    errors.push.apply(errors, fieldErrors);
    record.service = buildServiceFields(body.service);
  }

  if (errors.length) {
    return respond(400, { error: errors.join(" ") });
  }

  let autoApplyError = null;
  if (isSecl) {
    try {
      const resultEventId = action === "add-service"
        ? await applyServiceAndCommitToGitHub(record)
        : await applyAndCommitToGitHub(record, "Auto-apply");
      record.status = "approved";
      record.decidedAt = record.submittedAt;
      record.resultEventId = resultEventId;
    } catch (err) {
      // The event this SECL submission targeted doesn't exist (e.g. a
      // stale edit/delete/attend) — tell them now rather than silently
      // queuing something that can never be applied.
      if (err.userFacing) return respond(400, { error: err.message });
      // The GitHub write itself failed — fall back to queuing it for
      // review rather than losing the submission entirely.
      console.error("submit-request: auto-apply to GitHub failed:", err);
      autoApplyError = err;
    }
  }

  const client = getClient();

  const { error: insertError } = await client.from(TABLES.requests).insert({
    id: record.id,
    action: record.action,
    status: record.status,
    submitted_at: record.submittedAt,
    decided_at: record.decidedAt || null,
    name: record.name,
    organisation: record.organisation,
    email: record.email,
    note: record.note || null,
    target_id: record.targetId || null,
    // `event` is a generic jsonb payload column — for add-service it holds
    // the {name, logoBase64, logoMimeType} service fields instead of event
    // fields. Cheaper than a schema migration for a second payload shape.
    event: record.event || record.service || null,
    result_event_id: record.resultEventId || null
  });

  if (insertError) {
    console.error("submit-request: Supabase insert into " + TABLES.requests + " failed:", insertError);
    return respond(502, { error: "Couldn't save your request right now. Please try again shortly." });
  }

  // Best-effort — a contacts upsert failing shouldn't fail the submission.
  await client
    .rpc(RPC_UPSERT_CONTACT, { p_email: record.email, p_name: record.name, p_organisation: record.organisation })
    .then(function () {}, function () {});

  if (autoApplyError) {
    return respond(201, {
      id: record.id,
      autoApproved: false,
      warning: "Couldn't apply this instantly, so it's been queued for review instead."
    });
  }

  return respond(201, { id: record.id, autoApproved: isSecl });
};
