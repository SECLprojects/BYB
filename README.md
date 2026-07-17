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
  "date": "2026-09-12",
  "title": "BYB - Frankston",
  "venue": "Frankston Arts Centre",
  "region": "se",
  "status": "open",
  "host": "SECL",
  "time": "10am to 2pm"
}
```

### 2. Copy an existing event block and change the details

Field by field:

| Field | What to put | Notes |
|---|---|---|
| `date` | The event date, as `YYYY-MM-DD` | e.g. 12 September 2026 is `"2026-09-12"` |
| `title` | The event name shown everywhere | e.g. `"BYB - Frankston"` |
| `venue` | The building/venue name | Shown under the date |
| `region` | One of: `se`, `west`, `city`, `north`, `grey` | See below |
| `status` | One of: `open`, `full`, `discuss` | Leave this field out entirely for a holiday/heads-up entry |
| `host` | `"SECL"` or the partner organisation's name | Shown as a chip |
| `time` | The time range as plain text | e.g. `"10am to 2pm"` |

**Region codes:**
- `se` — South East
- `west` — West
- `city` — City
- `north` — North
- `grey` — "Heads up" entries: public holidays, breaks, anything that isn't a bookable BYB event. These show on the calendar grid but are **left out** of the "upcoming events" list and the landing page.

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

## What each file does

```
index.html      Landing page — hero, "what to bring", "what happens", add-event link
calendar.html   Shared events calendar — month grid + upcoming list
events.json     All event data — the only file you should need to edit day to day
styles.css      Shared styling for both pages
script.js       Shared logic: loads events.json, computes the next event, renders the calendar
_headers        Security headers for Netlify
robots.txt      Search engine crawling rules
sitemap.xml     Search engine sitemap
/assets         Logo, favicons, share image
```

## Placeholders to replace before launch

A few things in this build are stand-ins, called out in code comments and in the design brief:

- **Logo** (`assets/secl-logo.png`, favicons, `assets/og-share.png`): a placeholder purple circle mark. Swap in the real SECL brand mark exports when supplied, keeping the same filenames (or update the `<img>`/`<link>` references if filenames change).
- **Pattern band**: the diagonal diamond/dot band on the hero divider and the "add your event" band is placeholder geometry built from brand colours (see `.pattern-band--light` / `.pattern-band--dark` in `styles.css`). Replace the background-image data URI there when the real textile artwork is ready.
- **"+ Add your event" link**: both `index.html` and `calendar.html` have an HTML comment marking the button `href="#"` that needs to become the real ODK Public Access Link once it's published. Search both files for `ODK Public Access Link` to find it.
- **"Get directions" link**: currently opens a Google Maps search for the venue name. If venues get street addresses added to `events.json` later, this can be made more precise — not required for launch.
- **Domain in `robots.txt` and `sitemap.xml`**: both reference a placeholder `bringyourbills.org.au` domain since the site will launch on a temporary `*.netlify.app` address first. Update both files once the real custom domain is attached (the pages themselves only use relative links, so nothing else needs to change).

## Local preview

No server or build tool required — just open `index.html` in a browser. (Some browsers restrict `fetch()` for local `file://` pages; if events don't load locally, run any static file server, e.g. `python3 -m http.server`, and open `http://localhost:8000`.)

## Deploying to Netlify

- Build command: none.
- Publish directory: the project root (`/`).
- No environment variables needed.
