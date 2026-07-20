# Bring Your Bills website

A small static website for Bring Your Bills (BYB): a landing page and a shared events calendar.

- Live pages: `index.html` (landing) and `calendar.html` (calendar).
- No build step. It's plain HTML, CSS and JavaScript — edit a file, redeploy, done.

## Adding or changing an event (no coding needed)

All events come from **one file: `events.json`**. Both pages read it automatically — the landing page always shows the soonest upcoming event, and the calendar page lists everything.

### 1. Open `events.json`

It's a list of events. Each one looks like this:

```json
{
  "id": "2026-09-12-frankston",
  "date": "2026-09-12",
  "title": "BYB - Frankston",
  "venue": "Frankston Arts Centre",
  "region": "bayside-peninsula",
  "status": "open",
  "host": "SECL",
  "time": "10am to 2pm",
  "stakeholders": ["Merri Health"]
}
```

### 2. Copy an existing event block and change the details

Field by field:

| Field | What to put | Notes |
|---|---|---|
| `id` | A short unique code for this event | Convention: the date plus a short version of the title, e.g. `"2026-09-12-frankston"`. Only needs to be unique — used to target this exact event from an edit/delete/attendance request. |
| `date` | The event date, as `YYYY-MM-DD` | e.g. 12 September 2026 is `"2026-09-12"` |
| `title` | The event name shown everywhere | e.g. `"BYB - Frankston"` |
| `venue` | The building/venue name | Shown under the date |
| `region` | One of the region codes below | See below |
| `status` | One of: `open`, `full`, `discuss` | Leave this field out entirely for a holiday/heads-up entry |
| `host` | `"SECL"` or the partner organisation's name | Shown as a chip |
| `time` | The time range as plain text | e.g. `"10am to 2pm"` |
| `stakeholders` | A list of other organisations attending | Optional. Shown as extra chips alongside the host on the calendar page. Leave out entirely if it's just the host. |

**Region codes** — follows Victoria's DFFH-style catchment areas. On the site, colour is coded by the group in **bold** (there are too many individual regions for each to have its own colour) but the specific region name is always shown as well:

| Group | Region codes |
|---|---|
| **Metro** | `southern-melbourne`, `bayside-peninsula`, `inner-eastern-melbourne`, `outer-eastern-melbourne`, `north-eastern-melbourne`, `hume-merri-bek`, `brimbank-melton`, `western-melbourne` |
| **South West** | `wimmera-south-west`, `barwon`, `central-highlands` |
| **South Eastern** | `outer-gippsland`, `inner-gippsland` |
| **North Eastern** | `ovens-murray`, `goulburn` |
| **North Western** | `mallee`, `loddon-campaspe` |
| *(none)* | `grey` — "Heads up" entries: public holidays, breaks, anything that isn't a bookable BYB event. These show on the calendar grid but are **left out** of the "upcoming events" list and the landing page. |

The full list with display names is in `netlify/functions/_lib/validate.js` (`REGIONS`) and `script.js`/`request.js` (`REGION_META`) — all three must stay in sync if this ever changes.

**Status values:**
- `open` — spots available
- `full` — fully booked
- `discuss` — contact the host to discuss

### 3. Save the file

Make sure it's still valid JSON:
- Every event block is separated by a comma, except the very last one.
- The whole thing is wrapped in `[` and `]`.
- Use double quotes `"like this"`, not single quotes.

If you're not sure, paste the file into [jsonlint.com](https://jsonlint.com) to check before saving — a small typo (like a missing comma) will stop both pages from loading events.

### 4. Redeploy

If the site is connected to Netlify via GitHub, just commit and push your change to `events.json` — Netlify rebuilds automatically within a minute or two, no build command needed. If you're not sure how to commit and push, ask whoever set up the GitHub repository to show you once; after that it's the same two steps every time.

### You never need to touch anything else

- The **next event on the landing page** is worked out automatically from today's date — the soonest event still in the future. You don't set this anywhere, and you never need to remove past events (they simply stop showing on the "upcoming" list, though they still exist in the calendar's history for that month).
- The **month grid and upcoming list on the calendar page** rebuild themselves from `events.json` every time someone loads the page.

### Clearing all events, or adding events as SECL directly

Because SECL has direct write access to this GitHub repo (unlike partner organisations — see the request/approval workflow below), the simplest way for SECL to manage its own events is to skip `request.html` entirely and just edit `events.json` yourself:

- **To clear every event** (e.g. to start fresh): open `events.json` and replace the whole contents with `[]`, then commit and push. Both pages handle an empty list gracefully (a friendly "no events" message instead of a blank page).
- **To add an event as SECL**: add a new block to the array following the field table above, with `"host": "SECL"`. There's no special "SECL mode" — any event with `host` set to exactly `"SECL"` is styled as an SECL-run event (a highlighted host chip) wherever it appears.

The passcode-gated `request.html`/`review.html` flow described below exists for **partner organisations who don't have GitHub access** — SECL staff don't need to use it for their own events, though they're welcome to if they'd rather go through the same review queue as everyone else.

## Requests, approvals and "who's coming" — how it works

Partner organisations don't get GitHub access or a login. Instead:

1. A partner fills in **`request.html`** ("Request an event change") to add a new event, edit or remove one they host, or confirm their organisation is attending someone else's event. It asks for a **partner passcode** (shared with trusted partners — not a strong secret, just a filter against random public spam), their name, organisation and email, plus the event details.
2. That request is saved privately (see "Where requests are stored" below) — it does **not** go live yet and is **not** written anywhere in this GitHub repository.
3. SECL staff open **`review.html`** ("Review event requests"), enter the **staff passcode**, and see every pending request. Clicking **Approve** applies it to the live `events.json` automatically (no manual editing); **Reject** just dismisses it. Either way the partner's original request is kept on record as "approved"/"rejected" for reference.
4. `review.html` isn't linked from anywhere on the public site (and is excluded in `robots.txt`) — staff need the direct URL, `/review.html`, plus the staff passcode.

**Where requests are stored:** in a [Supabase](https://supabase.com) Postgres database — two tables, `byb_event_requests` (every request and its approve/reject history) and `byb_contacts` (a deduplicated, running list of everyone who's submitted, with a request count and last-seen date). Both are prefixed with `byb_` so they can't collide with any other tables already in your Supabase project. This deliberately keeps submitter names/emails out of `events.json` and out of git entirely — **this repository is public**, so anything committed to it would be visible to anyone, forever, in the git history. Only the final, approved, structured event fields ever reach `events.json`. Both tables have Row Level Security enabled with no public policies, so only the Netlify Functions (via a service-role key that's never exposed to a browser) can read or write them — staff can also browse, search and export both tables directly in Supabase's Table editor.

**The passcodes are a convenience, not a lock on the front door.** They stop casual/automated noise from reaching the request form and the review queue. The real safety check is the human clicking Approve/Reject on `review.html` — nothing reaches the public calendar without that.

### One-time setup (do this before the request/review pages will work)

Someone with admin access to Netlify, the GitHub repo, and (new) Supabase needs to:

1. **Create a GitHub token**: GitHub → Settings → Developer settings → Fine-grained personal access tokens → generate one scoped to **only this repository** with **Contents: Read and write** permission (nothing else).
2. **Create a Supabase project**: [supabase.com](https://supabase.com) → New project (pick the Sydney/`ap-southeast-2` region for Australian data residency). Open the SQL Editor, paste in the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it once — this creates the two tables and enables Row Level Security on both.
3. **Get your Supabase keys**: Project Settings → API → copy the **Project URL** and the **`service_role` secret key** (not the `anon`/public key — the service role key is what lets the Functions bypass RLS; never put it in any client-side code or commit it anywhere).
4. **Add environment variables** in Netlify (Site configuration → Environment variables):

   | Variable | Value |
   |---|---|
   | `GITHUB_TOKEN` | The token from step 1 — keep this secret, never commit it anywhere |
   | `GITHUB_OWNER` | `SECLprojects` |
   | `GITHUB_REPO` | `BYB` |
   | `GITHUB_BRANCH` | `main` |
   | `SUPABASE_URL` | The Project URL from step 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | The service role key from step 3 — keep this secret too |
   | `PARTNER_PASSCODE` | A code you share with trusted partner organisations |
   | `STAFF_PASSCODE` | A different, staff-only code — keep this one tighter-held since it can approve/reject |

5. **Redeploy** the site once the variables are saved so the Functions pick them up.

Netlify automatically bundles the code in `netlify/functions/` at deploy time — this is separate from, and doesn't change, the "no build command" setup for the site itself. The one dependency the Functions need (`@supabase/supabase-js`) lives in a root-level `package.json`, not inside `netlify/functions/` — Netlify only auto-installs a function's dependencies when they're declared at the project root; a `package.json` placed inside the functions folder itself is not installed automatically.

## What each file does

```
index.html            Landing page — hero, "what to bring", "what happens", add-event link
calendar.html          Shared events calendar — month grid + upcoming list
request.html/.js       Public form: add/edit/remove an event, or confirm attendance
review.html/.js        Staff-only queue: approve/reject pending requests
events.json            All live event data — the only file you should need to edit day to day
styles.css             Shared styling for all pages
script.js              Shared read-only logic: loads events.json, computes the next event, renders the calendar
netlify/functions/     Serverless functions backing request.html/review.html (see above)
netlify.toml           Tells Netlify where the functions live
package.json           Only exists to supply @supabase/supabase-js to the Functions — the site has no build step
supabase/schema.sql    Run once in Supabase's SQL editor to create the request/contacts tables
_headers               Security headers for Netlify
robots.txt             Search engine crawling rules (also keeps review.html out of search results)
sitemap.xml            Search engine sitemap
/assets                Logo, favicons, share image
```

## Placeholders to replace before launch

A few things in this build are stand-ins, called out in code comments and in the design brief:

- **Logo** (`assets/secl-logo.png`, favicons, `assets/og-share.png`): a placeholder purple circle mark. Swap in the real SECL brand mark exports when supplied, keeping the same filenames (or update the `<img>`/`<link>` references if filenames change).
- **Pattern band**: the diagonal diamond/dot band on the hero divider and the "add your event" band is placeholder geometry built from brand colours (see `.pattern-band--light` / `.pattern-band--dark` in `styles.css`). Replace the background-image data URI there when the real textile artwork is ready.
- **"Get directions" link**: currently opens a Google Maps search for the venue name. If venues get street addresses added to `events.json` later, this can be made more precise — not required for launch.
- **Domain in `robots.txt` and `sitemap.xml`**: both reference a placeholder `bringyourbills.org.au` domain since the site will launch on a temporary `*.netlify.app` address first. Update both files once the real custom domain is attached (the pages themselves only use relative links, so nothing else needs to change).

## Local preview

For the landing/calendar pages only, no server or build tool is required — just open `index.html` in a browser. (Some browsers restrict `fetch()` for local `file://` pages; if events don't load locally, run any static file server, e.g. `python3 -m http.server`, and open `http://localhost:8000`.)

To also exercise `request.html`/`review.html` and the Netlify Functions locally, install the [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run `netlify dev` from the project root — it serves the site and emulates the Functions and Blobs store together.

## Deploying to Netlify

- Build command: none (the main site has no build step; Netlify separately bundles the small amount of code in `netlify/functions/` automatically — see `netlify.toml`).
- Publish directory: the project root (`/`).
- Environment variables: see "One-time setup" above — the request/review workflow won't work without them, but the landing page and calendar work fine without any environment variables at all.
