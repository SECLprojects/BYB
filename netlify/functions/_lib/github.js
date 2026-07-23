// Minimal GitHub Contents API client used to read/write the public
// events.json file. Uses the runtime's built-in fetch — no npm dependency.
const API = "https://api.github.com";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

async function ghRequest(path, options) {
  options = options || {};
  const res = await fetch(API + path, {
    method: options.method || "GET",
    body: options.body,
    headers: Object.assign(
      {
        Authorization: "Bearer " + env("GITHUB_TOKEN"),
        Accept: "application/vnd.github+json",
        "User-Agent": "byb-site-functions"
      },
      options.headers || {}
    )
  });
  if (!res.ok) {
    const body = await res.text().catch(function () { return ""; });
    const err = new Error("GitHub API " + (options.method || "GET") + " " + path + " failed: " + res.status + " " + body);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Generic single-file read/write against the repo, shared by events.json,
// services.json, and service logo images. Returns null on a 404 (file
// doesn't exist yet) rather than throwing, so callers can decide whether
// that's an error or just "nothing there yet".
async function getRepoFile(path) {
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH || "main";
  try {
    const data = await ghRequest(
      "/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + encodeURIComponent(branch)
    );
    return { contentBase64: data.content.replace(/\n/g, ""), sha: data.sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// `contentBase64` must already be base64-encoded (text or binary alike —
// the GitHub Contents API always wants base64 regardless of file type).
// `sha` is the existing file's sha when overwriting, or omit/undefined
// for a brand-new file.
async function putRepoFile(path, contentBase64, sha, message) {
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH || "main";
  const body = { message: message, content: contentBase64, branch: branch };
  if (sha) body.sha = sha;
  return ghRequest("/repos/" + owner + "/" + repo + "/contents/" + path, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

async function getEventsFile() {
  const file = await getRepoFile("events.json");
  if (!file) throw new Error("events.json not found in the repo.");
  const content = Buffer.from(file.contentBase64, "base64").toString("utf-8");
  return { events: JSON.parse(content), sha: file.sha };
}

async function putEventsFile(events, sha, message) {
  const content = Buffer.from(JSON.stringify(events, null, 2) + "\n", "utf-8").toString("base64");
  return putRepoFile("events.json", content, sha, message);
}

module.exports = { getEventsFile, putEventsFile, getRepoFile, putRepoFile };
