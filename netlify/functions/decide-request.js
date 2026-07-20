const { getClient, rowToRecord, TABLES } = require("./_lib/supabase");
const { passcodeMatches } = require("./_lib/auth");
const { applyAndCommitToGitHub } = require("./_lib/apply-approval");
const { cleanString } = require("./_lib/validate");

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

  const id = cleanString(body.id, 200);
  const decision = body.decision;
  if (!id || (decision !== "approve" && decision !== "reject")) {
    return respond(400, { error: "A request id and decision ('approve' or 'reject') are required." });
  }

  const client = getClient();
  const { data: row, error: fetchError } = await client
    .from(TABLES.requests)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return respond(502, { error: "Couldn't load that request right now. Please try again shortly." });
  if (!row) return respond(404, { error: "That request no longer exists." });

  const record = rowToRecord(row);
  if (record.status !== "pending") {
    return respond(409, { error: "That request has already been " + record.status + "." });
  }

  if (decision === "reject") {
    const { error: updateError } = await client
      .from(TABLES.requests)
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) return respond(502, { error: "Couldn't save that decision. Please try again." });
    return respond(200, { ok: true });
  }

  let resultEventId;
  try {
    resultEventId = await applyAndCommitToGitHub(record, "Approve");
  } catch (err) {
    if (err.userFacing) return respond(400, { error: err.message });
    return respond(502, { error: err.message, detail: err.detail });
  }

  const { error: updateError } = await client
    .from(TABLES.requests)
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      result_event_id: resultEventId
    })
    .eq("id", id);

  if (updateError) {
    // The live site was already updated successfully — only the
    // record's own status failed to save. Surface this distinctly so
    // staff don't re-approve (which would duplicate the change).
    return respond(200, {
      ok: true,
      eventId: resultEventId,
      warning: "Applied to the live site, but couldn't mark the request as approved — please note this manually."
    });
  }
  return respond(200, { ok: true, eventId: resultEventId });
};
