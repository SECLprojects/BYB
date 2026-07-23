const { makeEventId } = require("./validate");

// Applies a single request (add/edit/delete/attend) to an in-memory copy
// of events.json, returning the updated array and the id of the event it
// touched. Pure/synchronous — no I/O — so it's used identically whether a
// human clicked Approve on review.html or an SECL submission auto-applies.
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
      else if (key === "status" || key === "address") delete updated[key];
    });
    // Clearing the address (with nothing geocoded to replace it) leaves
    // the old map pin pointing at an address that's no longer shown.
    if ((record.event.address === undefined || record.event.address === "") && updated.lat !== undefined && record.event.lat === undefined) {
      delete updated.lat;
      delete updated.lng;
    }
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
    // `attendingService` (the picked service directory entry) is the real
    // value going forward; falling back to `organisation` keeps any
    // already-queued pre-service-directory requests working through
    // deploy.
    const attendingName = (record.event && record.event.attendingService) || record.organisation;
    if (stakeholders.indexOf(attendingName) === -1) stakeholders.push(attendingName);
    events[idx] = Object.assign({}, existing, { stakeholders: stakeholders });
    return { events: events, resultEventId: existing.id };
  }

  throw new Error("Unknown action: " + record.action);
}

module.exports = { applyDecision };
