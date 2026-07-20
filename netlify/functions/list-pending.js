const { requestsStore } = require("./_lib/blobs");
const { passcodeMatches } = require("./_lib/auth");

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

  const store = requestsStore();
  const { blobs } = await store.list();

  const records = await Promise.all(
    blobs.map(function (b) {
      return store.get(b.key, { type: "json" });
    })
  );

  const requests = records
    .filter(Boolean)
    .sort(function (a, b) {
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    })
    .slice(0, 200);

  return respond(200, { requests: requests });
};
