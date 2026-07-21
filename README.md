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
  "address": "6 Young Street, Frankston",
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
| `address` | The street address | Optional. Shown on its own line under the venue, and used for the "Get directions" link if present. |
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
- **"+ Add to calendar"** on the landing hero and each upcoming event downloads a `.ics` file a visitor's phone or computer can open directly into Google/Apple/Outlook Calendar. It's generated entirely in the browser from the event's own data — nothing to configure. If `time` matches a plain pattern like `"10am to 2pm"` it becomes a timed entry; otherwise (or if it's missing) it falls back to an all-day entry so it's never wrong, just less specific.

### Clearing all events, or adding events as SECL directly

Because SECL has direct write access to this GitHub repo (unlike partner organisations — see the request/approval workflow below), the simplest way for SECL to manage its own events is to skip `request.html` entirely and just edit `events.json` yourself:

- **To clear every event** (e.g. to start fresh): open `events.json` and replace the whole contents with `[]`, then commit and push. Both pages handle an empty list gracefully (a friendly "no events" message instead of a blank page).
- **To add an event as SECL**: add a new block to the array following the field table above, with `"host": "SECL"`. There's no special "SECL mode" — any event with `host` set to exactly `"SECL"` is styled as an SECL-run event (a highlighted host chip) wherever it appears.

Editing `events.json` directly is one option. SECL can also use **`request.html`** with its own passcode (see below) for the same result without touching git at all — whichever's more convenient.

## Requests, approvals and "who's coming" — how it works

Partner organisations don't get GitHub access or a login. There are two passcodes for **submitting** through `request.html`, which behave differently:

- **Partner passcode** — shared with trusted partner organisations. A submission using it is saved as **pending** and waits for a staff member to approve it on `review.html`.
- **SECL passcode** — for SECL's own staff. A submission using it **applies immediately** — no review step, no second click. Use this one only for SECL's own routine event admin; give partners the partner passcode instead.

Either way, here's the flow:

1. Someone fills in **`request.html`** ("Request an event change") to add a new event, edit or remove one they host, or confirm their organisation is attending someone else's event — with their name, organisation, email, and the event details.
2. **Partner passcode**: the request is saved privately (see "Where requests are stored" below) and does **not** go live yet.
   **SECL passcode**: the change is applied to the live `events.json` immediately, the same way an approval would.
3. SECL staff can open **`review.html`** ("Review event requests"), enter the **staff passcode**, and see every request — pending ones with Approve/Reject buttons, plus a history of everything already decided (including anything SECL auto-applied, for a full audit trail). Clicking **Approve** applies a pending request to `events.json` automatically (no manual editing); **Reject** just dismisses it.
4. `review.html` isn't linked from anywhere on the public site (and is excluded in `robots.txt`) — staff need the direct URL, `/review.html`, plus the staff passcode.

**Where requests are stored:** in a [Supabase](https://supabase.com) Postgres database — two tables, `byb_event_requests` (every request and its approve/reject history, including auto-applied ones) and `byb_contacts` (a deduplicated, running list of everyone who's submitted, with a request count and last-seen date). Both are prefixed with `byb_` so they can't collide with any other tables already in your Supabase project. This deliberately keeps submitter names/emails out of `events.json` and out of git entirely — **this repository is public**, so anything committed to it would be visible to anyone, forever, in the git history. Only the final, approved, structured event fields ever reach `events.json`. Both tables have Row Level Security enabled with no public policies, so only the Netlify Functions (via a service-role key that's never exposed to a browser) can read or write them — staff can also browse, search and export both tables directly in Supabase's Table editor.

**The passcodes are a convenience, not a lock on the front door.** For the partner passcode, that's by design — the real safety check is the human clicking Approve/Reject on `review.html`. The SECL passcode is different: because it skips that human check and writes straight to the public calendar, treat it like a real credential — share it only with SECL staff who add/edit events, and change it if you ever suspect it's leaked.

## "Let us know you're coming" — event registrations

Anyone — community members, not just partner organisations — can optionally register interest in an event on **`register.html`** (linked as "Let us know you're coming" next to each event on the landing hero and the calendar page). No passcode: it's open to the public, same as the calendar itself.

A few deliberate choices here, since this collects data from individual members of the public rather than organisations:

- **It's always optional.** Nothing on the site implies you need to register to attend — walk-ins are welcome regardless. It exists purely so SECL can plan staffing and interpreters ahead of time.
- **Name and contact details are optional.** Someone can register just a headcount and what they need help with without giving their name.
- **"What do you need help with?" is a fixed set of checkboxes** (energy / water / phone-internet / other / not sure), not an open text box — useful for planning without inviting anyone to type out their personal financial situation into a web form.
- **It's never shown publicly.** Registrations live in `byb_event_registrations` in Supabase (RLS enabled, no public policies, same protection model as the request tables above) and are only visible to SECL staff on **`registrations.html`** — a passcode-gated page (reuses `STAFF_PASSCODE`) grouped by event, showing headcount, interpreter needs, and a category breakdown for planning. Like `review.html`, it's unlinked from the public site and excluded in `robots.txt`.
- **A honeypot field** (hidden from real visitors, invisible to screen readers) deters basic bots — there's no CAPTCHA, since that would mean an external JS dependency the rest of the site deliberately avoids. If spam becomes a real problem, that trade-off is worth revisiting.

**Before this goes live publicly**, have whoever handles privacy/compliance for SECL sign off on the registration form and its wording — collecting data from the general public, including people who may be in financial hardship, carries obligations under the Privacy Act that are yours to meet, not something this build can certify on your behalf.

No new environment variables are needed for this — it reuses `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` and `STAFF_PASSCODE`. If you already ran `supabase/schema.sql` before this feature was added, re-run it — it only adds the new `byb_event_registrations` table and is safe to run again (`create table if not exists`).

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
   | `PARTNER_PASSCODE` | A code you share with trusted partner organisations — submissions queue for review |
   | `SECL_PASSCODE` | A separate code for SECL staff only — submissions using it apply instantly, no review step. Treat this like a real password. |
   | `STAFF_PASSCODE` | A different, staff-only code for `review.html` — keep this one tighter-held since it can approve/reject |

5. **Redeploy** the site once the variables are saved so the Functions pick them up.

Netlify automatically bundles the code in `netlify/functions/` at deploy time — this is separate from, and doesn't change, the "no build command" setup for the site itself. The one dependency the Functions need (`@supabase/supabase-js`) lives in a root-level `package.json`, not inside `netlify/functions/` — Netlify only auto-installs a function's dependencies when they're declared at the project root; a `package.json` placed inside the functions folder itself is not installed automatically.

## What each file does

```
index.html            Landing page — hero, "what to bring", "what happens", add-event link
calendar.html          Shared events calendar — month grid + upcoming list
request.html/.js       Public form: add/edit/remove an event, or confirm attendance
review.html/.js        Staff-only queue: approve/reject pending requests
register.html/.js      Public form: anyone can optionally register interest in an event
registrations.html/.js Staff-only view: registrations grouped by event, for planning
events.json            All live event data — the only file you should need to edit day to day
styles.css             Shared styling for all pages
script.js              Shared read-only logic: loads events.json, computes the next event, renders the calendar
netlify/functions/     Serverless functions backing request/review/register/registrations (see above)
netlify.toml           Tells Netlify where the functions live
package.json           Only exists to supply @supabase/supabase-js to the Functions — the site has no build step
supabase/schema.sql    Run once in Supabase's SQL editor to create the request/contacts/registrations tables
_headers               Security headers for Netlify
robots.txt             Search engine crawling rules (also keeps review.html out of search results)
sitemap.xml            Search engine sitemap
/assets                Logo, favicons, share image
```

## Placeholders to replace before launch

A few things in this build are still stand-ins, called out in code comments and in the design brief:

- **Pattern band**: the diagonal diamond/dot band on the hero divider and the "add your event" band is placeholder geometry built from brand colours (see `.pattern-band--light` / `.pattern-band--dark` in `styles.css`). Replace the background-image data URI there when the real textile artwork is ready.
- **Domain in `robots.txt` and `sitemap.xml`**: both reference a placeholder `bringyourbills.org.au` domain since the site will launch on a temporary `*.netlify.app` address first. Update both files once the real custom domain is attached (the pages themselves only use relative links, so nothing else needs to change).

The logo (`assets/secl-logo.png`, favicons, `assets/og-share.png`) is now the real SECL brand mark, cropped to a proper square from the supplied file. If a new export is supplied later, keep it square (or crop it first) — a non-square file forced into the site's square `<img>` boxes will look stretched.

## Local preview

For the landing/calendar pages only, no server or build tool is required — just open `index.html` in a browser. (Some browsers restrict `fetch()` for local `file://` pages; if events don't load locally, run any static file server, e.g. `python3 -m http.server`, and open `http://localhost:8000`.)

To also exercise `request.html`/`review.html` and the Netlify Functions locally, install the [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run `netlify dev` from the project root — it serves the site and emulates the Functions and Blobs store together.

## Deploying to Netlify

- Build command: none (the main site has no build step; Netlify separately bundles the small amount of code in `netlify/functions/` automatically — see `netlify.toml`).
- Publish directory: the project root (`/`).
- Environment variables: see "One-time setup" above — the request/review workflow won't work without them, but the landing page and calendar work fine without any environment variables at all.
