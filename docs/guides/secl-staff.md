# Bring Your Bills — guide for SECL staff

This is the full "how to drive it" guide for South East Community Links
staff. It covers every page, including the two staff-only pages that
aren't linked from the site.

## The passcodes (read this first)

The site uses three passcodes. They're set up in Netlify by whoever
administers the site — **they are not written down anywhere in this
guide or on the website**, so ask your site administrator for the ones
you need.

| Passcode | Who gets it | What it does |
|---|---|---|
| **Partner passcode** | Trusted partner organisations (and you can use it too) | Lets someone submit an event request on the request form. The request **waits for staff approval** before anything goes live. |
| **SECL passcode** | SECL staff only | Same form — but the change **applies to the live site instantly**, no review step. Treat it like a real password. |
| **Staff passcode** | A tighter circle of SECL staff | Unlocks the two staff-only pages: the review queue and the registrations view. |

If you ever suspect a passcode has leaked, ask the site administrator to
change it in Netlify (Site configuration → Environment variables) and
redeploy.

## Every page at a glance

| Page | Type this in your browser | Who can see it |
|---|---|---|
| Home | `bringyourbills.org.au` | Everyone |
| Calendar | `bringyourbills.org.au/calendar.html` | Everyone |
| Map | `bringyourbills.org.au/map.html` | Everyone |
| Single event | `bringyourbills.org.au/event.html?id=<event id>` (linked from calendar/map) | Everyone |
| Let us know you're coming | `bringyourbills.org.au/register.html` | Everyone |
| Request an event change | `bringyourbills.org.au/request.html` | Everyone can open it, but submitting needs a passcode |
| **Review event requests** | `bringyourbills.org.au/review.html` | Staff — needs the staff passcode. Not linked from the site, not indexed by search engines. |
| **Event registrations** | `bringyourbills.org.au/registrations.html` | Staff — needs the staff passcode. Also unlinked and unindexed. |

Bookmark the last two — you'll always type or bookmark them directly.

## Adding a new event (the everyday task)

1. Go to `bringyourbills.org.au/request.html`.
2. In the **passcode** box, enter the **SECL passcode** (so it applies
   instantly — no second step).
3. Fill in your name, "South East Community Links", and your work email.
4. Under **"What would you like to do?"** choose **"Add a new event"**.
5. Fill in the event details:
   - **Date** and **time** (time as plain text, e.g. `10am to 3pm`).
   - **Title** — e.g. `Bring Your Bills City of Casey`.
   - **Venue** and **address**. Always give the street address if you
     can — it powers the "Get directions" button and puts the event's
     pin on the map **automatically** (the site looks up the coordinates
     for you; nothing to do).
   - **Region** — pick from the list (grouped the way DFFH groups
     Victorian areas). This drives the colour coding and the "filter by
     region" feature.
   - **Status** — `Open` (spots available), `Full`, or `Call to
     discuss`.
   - **Host** — `SECL`, or the partner's name if they're hosting.
   - **Event type** — SECL event, Partnership event, or Other BYB
     event. This chip is only shown to staff on the review page, so pick
     honestly; the public never sees it.
6. Press **Send request**. Because you used the SECL passcode, the event
   is live on the calendar, map and home page within a minute or two.

**Tip:** the home page always shows the *soonest upcoming* event
automatically. Past events drop off the "upcoming" list by themselves —
you never need to clean them up.

## Editing or removing an event

Same form, same SECL passcode:

1. `bringyourbills.org.au/request.html`, enter the SECL passcode and
   your details.
2. Choose **"Edit an event"** or **"Remove an event"**.
3. Pick the event from the **"Existing event"** dropdown.
4. For an edit, fill in the event details as they should now read (the
   whole form, not just the changed field).
5. Press **Send request** — applied instantly.

## Reviewing partner requests

When a partner submits with the *partner* passcode, nothing goes live
until you approve it:

1. Go to `bringyourbills.org.au/review.html` (type it directly — it's
   not linked anywhere).
2. Enter the **staff passcode** and press **View requests**.
3. **Pending requests** are listed at the top with the submitter's name,
   organisation and email, plus everything they asked for. For a new
   service/logo request you'll see the logo previewed.
4. Press **Approve** to apply it to the live site automatically (no
   manual editing), or **Reject** to dismiss it.
5. **Recently decided** below is your audit trail — every approval,
   rejection, and everything SECL auto-applied with the SECL passcode.

The submitter's contact details are never published — only the final
event fields reach the public site. Follow up with them by email to let
them know the outcome (the site doesn't email them automatically).

## Seeing who's coming — registrations

1. Go to `bringyourbills.org.au/registrations.html` (again, type it
   directly).
2. Enter the **staff passcode** and press **View registrations**.
3. Registrations are grouped **by event**, showing for each: expected
   headcount, interpreter needs (and languages), what people need help
   with (category counts — good for planning which providers to invite),
   and any contact details people chose to leave, with their consent
   status.
4. **Export CSV** downloads the lot as a spreadsheet for planning or
   reporting.
5. Every registration has a **Delete** button — use it when someone asks
   for their details to be removed (privacy requests shouldn't wait for
   the automatic 5-year purge).

Further down the same page, **Link clicks** shows how often each tracked
button on the site has been used (e.g. "Add to calendar", "Get
directions") — counts only, no visitor data.

## Adding a service / partner logo to the directory

Event pages show "Services at this event" with each organisation's logo.
Logos come from a reusable directory, so each one only ever needs
uploading once:

1. `bringyourbills.org.au/request.html`, enter the **SECL passcode**
   (instant) and your details.
2. Choose **"Add a new service/partner logo"**.
3. Type the service/organisation name and choose the logo file — PNG,
   JPEG or WebP, **under 500KB**, roughly square looks best.
4. Press **Send request**.

From then on, that service appears in the **"Which service is
attending"** dropdown, and its logo shows automatically on any event
it's attached to. Partners can submit their own logo with the partner
passcode — it just queues for your approval on the review page first.

## Marking a service as attending an event

1. Same form, choose **"Confirm attendance at an event"**.
2. Pick the **event** and pick the **service** from the directory
   dropdown. (If the service isn't listed yet, add it first — see
   above.)
3. Send. The service (with logo) now appears on that event's page,
   alphabetically.

## Holidays and "heads up" notices

To put a non-bookable note on the calendar (public holiday, office
closure): add an event as normal but choose region **"Heads up / holiday
(no status)"**. It shows grey on the calendar grid and is deliberately
left out of the upcoming list and home page.

## Things that happen automatically (nothing to do)

- Map pins: addresses are geocoded when an event is approved/applied.
- Home page "next event": always the soonest future event.
- Past events: drop off the upcoming list on their own.
- "Add to calendar" files: generated from the event's own details.
- Old data: requests, registrations and contacts are auto-deleted after
  5 years (monthly scheduled job) for privacy compliance.

## When something goes wrong

- **"Passcode not recognised"** — check for stray spaces, and confirm
  with the site administrator that you have the current passcode.
- **"Couldn't save your request right now"** — usually a configuration
  issue on the server side. The site administrator can check the
  function logs in Netlify (Project → Logs → Functions).
- **An event isn't on the map** — it probably has no street address, or
  the address couldn't be found. Edit the event and give a fuller
  address; it re-geocodes on apply. Unplaced events are listed at the
  bottom of the map page so they're never lost.
- Anything else: the technical README in the website's GitHub repository
  covers setup, hosting and data storage in full.
