const { getEventsFile, putEventsFile } = require("./_lib/github");
const { geocodeAddress } = require("./_lib/geocode");
const { passcodeMatches } = require("./_lib/auth");

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(statusCode, data) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Staff-triggered, one-off: geocodes any event in events.json that doesn't
// already have lat/lng — for events added before map.html existed, or
// where a lookup failed the first time. New events auto-geocode on
// approval (see apply-approval.js) and don't need this. Safe to re-run any
// time; already-geocoded events are left untouched. Respects Nominatim's
// ~1 request/second usage policy with a short delay between lookups.
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

  const { events, sha } = await getEventsFile();

  const results = [];
  for (const ev of events) {
    if (typeof ev.lat === "number" && typeof ev.lng === "number") continue;
    const query = ev.address || ev.venue;
    if (!query) continue;

    const coords = await geocodeAddress(query + ", Victoria, Australia");
    if (coords) {
      ev.lat = coords.lat;
      ev.lng = coords.lng;
      results.push({ id: ev.id, found: true });
    } else {
      results.push({ id: ev.id, found: false });
    }
    await sleep(1100);
  }

  if (!results.length) {
    return respond(200, { updated: 0, results: [] });
  }

  await putEventsFile(events, sha, "Backfill geocode " + results.filter((r) => r.found).length + "/" + results.length + " event(s)");

  return respond(200, { updated: results.filter((r) => r.found).length, results: results });
};
