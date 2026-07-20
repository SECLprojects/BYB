const { requestsStore } = require("./_lib/blobs");
const { passcodeMatches } = require("./_lib/auth");
const { getEventsFile, putEventsFile } = require("./_lib/github");
const { makeEventId, cleanString } = require("./_lib/validate");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

function applyDecision(events, record) {
  if (record.action === "add") {
    const id = makeEventId(record.event.date, record.event.title);
    const newEvent = { id: id };
    Object.keys(record.event).forEach(function (key) {
      if (record.event[key] !== undefined && record.event[key] !== "") newEvent[key] = record.event[key];
    });
    events.push(newEvent);
    return { events: events, resultEventId: id };
  }

  const idx = events.findIndex(function (ev) { return ev.id === record.targetId; });
  if (idx === -1) {
    const err = new Error("The event this request targets no longer exists (it may have already been edited or removed).");
    err.userFacing = true;
    throw err;
  }

  if (record.action === "edit") {
    const existing = events[idx];
    const updated = Object.assign({}, existing);
    Object.keys(record.event).forEach(function (key) {
      if (record.event[key] !== undefined && record.event[key] !== "") updated[key] = record.event[key];
      else if (key === "status") delete updated.status;
    });
    events[idx] = updated;
    return { events: events, resultEventId: existing.id };
  }

  if (record.action === "delete") {
    events.splice(idx, 1);
    return { events: events, resultEventId: record.targetId };
  }

  if (record.action === "attend") {
    const existing = events[idx];
    const stakeholders = Array.isArray(existing.stakeholders) ? existing.stakeholders.slice() : [];
    if (stakeholders.indexOf(record.organisation) === -1) stakeholders.push(record.organisation);
    events[idx] = Object.assign({}, existing, { stakeholders: stakeholders });
    return { events: events, resultEventId: existing.id };
  }

  throw new Error("Unknown action: " + record.action);
}

exports.applyDecision = applyDecision;

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

  const store = requestsStore();
  const record = await store.get(id, { type: "json" });
  if (!record) return respond(404, { error: "That request no longer exists." });
  if (record.status !== "pending") {
    return respond(409, { error: "That request has already been " + record.status + "." });
  }

  if (decision === "reject") {
    record.status = "rejected";
    record.decidedAt = new Date().toISOString();
    await store.setJSON(id, record);
    return respond(200, { ok: true });
  }

  // Approve: apply the change to the live events.json in GitHub, then mark
  // the request resolved. One retry if the file changed between read and
  // write (rare, low-traffic site).
  let attempt = 0;
  let lastErr;
  while (attempt < 2) {
    attempt += 1;
    try {
      const { events, sha } = await getEventsFile();
      const { events: updatedEvents, resultEventId } = applyDecision(events, record);
      updatedEvents.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
      const message =
        "Approve " + record.action + " request from " + record.organisation + " (" + resultEventId + ")";
      await putEventsFile(updatedEvents, sha, message);

      record.status = "approved";
      record.decidedAt = new Date().toISOString();
      record.resultEventId = resultEventId;
      await store.setJSON(id, record);
      return respond(200, { ok: true, eventId: resultEventId });
    } catch (err) {
      lastErr = err;
      if (err.userFacing) {
        return respond(400, { error: err.message });
      }
      // 409/422 from GitHub usually means the sha was stale — retry once.
      if (err.status !== 409 && err.status !== 422) break;
    }
  }

  return respond(502, {
    error: "Couldn't save this to the live site. Nothing was changed — try approving again.",
    detail: String((lastErr && lastErr.message) || lastErr)
  });
};
