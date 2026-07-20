// Victorian DFFH-style catchments: 8 metro + 9 regional (across 4 clusters),
// plus "grey" for non-BYB heads-up/holiday entries. Keep in sync with the
// REGION_META table in script.js and request.js.
const REGIONS = [
  // Metro
  "southern-melbourne",
  "bayside-peninsula",
  "inner-eastern-melbourne",
  "outer-eastern-melbourne",
  "north-eastern-melbourne",
  "hume-merri-bek",
  "brimbank-melton",
  "western-melbourne",
  // South West cluster
  "wimmera-south-west",
  "barwon",
  "central-highlands",
  // South Eastern cluster
  "outer-gippsland",
  "inner-gippsland",
  // North Eastern cluster
  "ovens-murray",
  "goulburn",
  // North Western cluster
  "mallee",
  "loddon-campaspe",
  // Non-geographic
  "grey"
];
const STATUSES = ["open", "full", "discuss"];
const ACTIONS = ["add", "edit", "delete", "attend"];

function isValidDateStr(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d.getTime());
}

function isValidEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
}

function makeEventId(date, title) {
  return date + "-" + slugify(title);
}

function cleanString(v, maxLen) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen || 500);
}

// Validates the {date, title, venue, region, status, host, time} fields
// carried on "add" and "edit" requests. Returns a list of error strings
// (empty = valid).
function validateEventFields(event) {
  const errors = [];
  if (!event || typeof event !== "object") {
    return ["Event details are missing."];
  }
  if (!isValidDateStr(event.date)) errors.push("Date must be a valid YYYY-MM-DD date.");
  if (!cleanString(event.title, 200)) errors.push("Title is required.");
  if (!REGIONS.includes(event.region)) errors.push("Region must be one of: " + REGIONS.join(", ") + ".");
  if (!cleanString(event.host, 200)) errors.push("Host is required.");
  if (event.status && !STATUSES.includes(event.status)) {
    errors.push("Status must be one of: " + STATUSES.join(", ") + " (or left blank).");
  }
  return errors;
}

module.exports = {
  REGIONS,
  STATUSES,
  ACTIONS,
  isValidDateStr,
  isValidEmail,
  slugify,
  makeEventId,
  cleanString,
  validateEventFields
};
