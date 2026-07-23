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
const ACTIONS = ["add", "edit", "delete", "attend", "add-service"];

// SECL event: SECL runs it alone. Partnership event: SECL and a community
// partner running it together. Other BYB event: a council/service running
// its own Bring Your Bills event under the shared calendar, without SECL
// directly involved. Kept as an explicit field the submitter sets, rather
// than inferred from host/stakeholders, since only they know which applies.
const EVENT_TYPES = ["secl", "partnership", "other"];

// Service/partner logo uploads (see add-service action) — kept small and
// raster-only. Deliberately no SVG: it's rendered via plain <img> here so
// it can't execute embedded scripts either way, but restricting to a
// couple of common raster formats keeps validation simple.
const SERVICE_LOGO_MAX_BYTES = 500 * 1024;
const SERVICE_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Kept deliberately categorical (no open "describe your situation" field)
// for the public "let us know you're coming" registration form. Keep in
// sync with BILL_CATEGORIES in register.js.
const BILL_CATEGORIES = ["energy", "water", "phone-internet", "other", "not-sure"];

// Allowlist for the click-tracking beacon — a public, no-passcode endpoint,
// so we only ever record link ids we defined ourselves rather than whatever
// a script sends. Keep in sync with data-track attributes in the HTML.
const LINK_IDS = [
  "nav-see-all-events",
  "hero-see-full-calendar",
  "hero-get-directions",
  "hero-see-all-events",
  "hero-add-to-calendar",
  "hero-lets-know-coming",
  "cta-add-your-event",
  "upcoming-add-to-calendar",
  "upcoming-lets-know-coming",
  "home-preview-see-full-calendar",
  "nav-map",
  "hero-view-on-map",
  "upcoming-view-on-map",
  "map-get-directions",
  "map-lets-know-coming",
  "upcoming-view-event",
  "map-view-event",
  "event-get-directions",
  "event-add-to-calendar",
  "event-lets-know-coming",
  "event-view-on-map"
];

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

// Validates the {date, title, venue, region, status, host, time, eventType}
// fields carried on "add" and "edit" requests. Returns a list of error
// strings (empty = valid).
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
  if (event.eventType && !EVENT_TYPES.includes(event.eventType)) {
    errors.push("Event type must be one of: " + EVENT_TYPES.join(", ") + " (or left blank).");
  }
  return errors;
}

// Validates an add-service request: { name, logoBase64, logoMimeType }.
function validateServiceFields(service) {
  const errors = [];
  if (!service || typeof service !== "object") {
    return ["Service details are missing."];
  }
  if (!cleanString(service.name, 200)) errors.push("Service name is required.");
  if (!SERVICE_LOGO_MIME_TYPES.includes(service.logoMimeType)) {
    errors.push("Logo must be a PNG, JPEG, or WebP image.");
  }
  if (typeof service.logoBase64 !== "string" || !service.logoBase64) {
    errors.push("Logo image is required.");
  } else {
    // Base64 inflates size by ~4/3 — approximate the decoded byte count
    // without actually decoding, just to bound it before we do.
    const approxBytes = Math.floor((service.logoBase64.length * 3) / 4);
    if (approxBytes > SERVICE_LOGO_MAX_BYTES) {
      errors.push("Logo image must be under " + Math.round(SERVICE_LOGO_MAX_BYTES / 1024) + "KB.");
    }
  }
  return errors;
}

module.exports = {
  REGIONS,
  STATUSES,
  ACTIONS,
  EVENT_TYPES,
  BILL_CATEGORIES,
  LINK_IDS,
  SERVICE_LOGO_MAX_BYTES,
  SERVICE_LOGO_MIME_TYPES,
  isValidDateStr,
  isValidEmail,
  slugify,
  makeEventId,
  cleanString,
  validateEventFields,
  validateServiceFields
};
