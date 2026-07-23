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
// atomically — acceptable here since a partial failure just means "logo
// uploaded, directory entry didn't update yet", not lost/corrupted data,
// and the whole thing is safe to retry.
async function applyServiceAndCommitToGitHub(record) {
  const slug = slugify(record.service.name);
  const ext = EXT_BY_MIME[record.service.logoMimeType] || "png";
  const logoPath = "assets/services/" + slug + "." + ext;

  const existingLogo = await getRepoFile(logoPath);
  await putRepoFile(
    logoPath,
    record.service.logoBase64,
    existingLogo ? existingLogo.sha : undefined,
    "Add/update logo for " + record.service.name
  );

  const { services, sha } = await getServicesFile();
  const idx = services.findIndex(function (s) { return s.id === slug; });
  const entry = { id: slug, name: record.service.name, logo: logoPath };
  if (idx === -1) services.push(entry);
  else services[idx] = entry;
  services.sort(function (a, b) { return a.name.localeCompare(b.name); });

  const content = Buffer.from(JSON.stringify(services, null, 2) + "\n", "utf-8").toString("base64");
  await putRepoFile(
    "services.json",
    content,
    sha,
    "Add/update service: " + record.service.name
  );

  return slug;
}

module.exports = { applyServiceAndCommitToGitHub, getServicesFile };
