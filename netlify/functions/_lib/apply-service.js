const { getRepoFile, putRepoFile } = require("./github");
const { slugify } = require("./validate");

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

async function getServicesFile() {
  const file = await getRepoFile("services.json");
  if (!file) return { services: [], sha: undefined };
  const content = Buffer.from(file.contentBase64, "base64").toString("utf-8");
  return { services: JSON.parse(content), sha: file.sha };
}

// Adds or updates a service in services.json and uploads its logo to
// assets/services/<slug>.<ext>. Two separate GitHub Contents API calls
// (logo, then services.json) since that API can't commit multiple files
// atomically. A partial failure just means "logo uploaded, directory entry
// didn't update yet" — not lost/corrupted data — and the whole thing is
// safe to retry.
//
// Identity is resolved by the service NAME (the value events store in their
// `stakeholders` and match on), so re-adding an existing service updates it
// in place even if an older/seed directory entry has no `id`. A brand-new
// service gets a slug id; if that slug is already taken by a *different*
// service (two names that slugify the same, or a truncation collision) it's
// disambiguated with a numeric suffix so one service can never clobber
// another's entry or logo.
async function applyServiceAndCommitToGitHub(record) {
  const name = record.service.name;
  const ext = EXT_BY_MIME[record.service.logoMimeType] || "png";

  let { services, sha } = await getServicesFile();

  const existing = services.find(function (s) { return s.name === name; });
  let slug;
  if (existing && existing.id) {
    slug = existing.id;
  } else {
    const base = slugify(name);
    slug = base;
    let n = 2;
    while (services.some(function (s) { return s.id === slug && s.name !== name; })) {
      slug = base + "-" + n;
      n += 1;
    }
  }

  const logoPath = "assets/services/" + slug + "." + ext;

  const existingLogo = await getRepoFile(logoPath);
  await putRepoFile(
    logoPath,
    record.service.logoBase64,
    existingLogo ? existingLogo.sha : undefined,
    "Add/update logo for " + name
  );

  const entry = { id: slug, name: name, logo: logoPath };

  // Retry the directory write on a stale-sha 409/422, matching the
  // protection in apply-approval.js — the logo PUT above committed a
  // separate file, and another service write could land in between.
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      const fresh = await getServicesFile();
      services = fresh.services;
      sha = fresh.sha;
    }
    const idx = services.findIndex(function (s) { return s.id === slug || s.name === name; });
    if (idx === -1) services.push(entry);
    else services[idx] = entry;
    services.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });

    const content = Buffer.from(JSON.stringify(services, null, 2) + "\n", "utf-8").toString("base64");
    try {
      await putRepoFile("services.json", content, sha, "Add/update service: " + name);
      return slug;
    } catch (err) {
      lastErr = err;
      if (err.status !== 409 && err.status !== 422) throw err;
    }
  }
  throw lastErr;
}

module.exports = { applyServiceAndCommitToGitHub, getServicesFile };
