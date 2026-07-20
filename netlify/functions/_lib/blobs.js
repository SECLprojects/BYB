const { getStore } = require("@netlify/blobs");

// Private store for pending/approved/rejected event-change requests.
// Never exposed to the public site or committed to git — only reachable
// from these Functions, which is exactly why submitter contact details
// (name, org, email) are safe to keep here even though the repo is public.
function requestsStore() {
  return getStore({ name: "byb-requests", consistency: "strong" });
}

module.exports = { requestsStore };
