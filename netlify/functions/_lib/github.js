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

async function getEventsFile() {
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH || "main";
  const data = await ghRequest(
    "/repos/" + owner + "/" + repo + "/contents/events.json?ref=" + encodeURIComponent(branch)
  );
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { events: JSON.parse(content), sha: data.sha };
}

async function putEventsFile(events, sha, message) {
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH || "main";
  const content = Buffer.from(JSON.stringify(events, null, 2) + "\n", "utf-8").toString("base64");
  return ghRequest("/repos/" + owner + "/" + repo + "/contents/events.json", {
    method: "PUT",
    body: JSON.stringify({ message: message, content: content, sha: sha, branch: branch })
  });
}

module.exports = { getEventsFile, putEventsFile };
