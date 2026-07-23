const { getEventsFile, putEventsFile } = require("./github");
const { applyDecision } = require("./apply-decision");
const { geocodeAddress } = require("./geocode");

// Applies `record` to the live events.json via the GitHub API and commits
// it. Retries once if the file changed between read and write (rare on a
// low-traffic site). Used both when a human clicks Approve on
// review.html and when an SECL submission auto-applies instantly.
//
// Throws on failure. `err.userFacing` means the message is safe to show
// the submitter verbatim (e.g. "that event no longer exists"); anything
// else means the write itself failed and nothing was changed.
async function applyAndCommitToGitHub(record, messagePrefix) {
  // Auto-geocode a fresh address/venue so the event gets a pin on map.html
  // without anyone having to enter coordinates. If the submitter left the
  // address/venue blank on an edit (meaning "don't change it"), there's
  // nothing new to geocode — applyDecision already keeps the existing
  // event's lat/lng in that case. A failed or skipped lookup just means no
  // pin, not a blocked approval.
  if ((record.action === "add" || record.action === "edit") && record.event) {
    const query = record.event.address || record.event.venue;
    if (query) {
      const coords = await geocodeAddress(query + ", Victoria, Australia");
      if (coords) {
        record.event.lat = coords.lat;
        record.event.lng = coords.lng;
      }
    }
  }

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { events, sha } = await getEventsFile();
      const { events: updatedEvents, resultEventId } = applyDecision(events, record);
      updatedEvents.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
      const message = messagePrefix + " " + record.action + " request from " + record.organisation + " (" + resultEventId + ")";
      await putEventsFile(updatedEvents, sha, message);
      return resultEventId;
    } catch (err) {
      lastErr = err;
      if (err.userFacing) throw err;
      // 409/422 from GitHub usually means the sha was stale — retry once.
      if (err.status !== 409 && err.status !== 422) break;
    }
  }
  const err = new Error("Couldn't save this to the live site. Nothing was changed — please try again.");
  err.detail = String((lastErr && lastErr.message) || lastErr);
  throw err;
}

module.exports = { applyAndCommitToGitHub };
