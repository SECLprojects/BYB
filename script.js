/* ==========================================================================
   Bring Your Bills — shared script
   Loaded by both index.html and calendar.html. Each page's init only runs
   if that page's markup is present, so one file can serve both.
   ========================================================================== */
(function () {
  "use strict";

  // Victorian DFFH-style catchments: 8 metro + 9 regional (across 4
  // clusters), plus "grey" for non-BYB heads-up/holiday entries. Colour is
  // coded by group (see chip-group-* / legend-swatch-group-* in
  // styles.css) since there are too many individual regions for distinct
  // colours — the specific region name is always shown as chip text too.
  // Keep in sync with REGIONS in netlify/functions/_lib/validate.js and
  // REGION_META in request.js.
  var REGION_META = {
    "southern-melbourne": { label: "Southern Melbourne", group: "metro" },
    "bayside-peninsula": { label: "Bayside Peninsula", group: "metro" },
    "inner-eastern-melbourne": { label: "Inner Eastern Melbourne", group: "metro" },
    "outer-eastern-melbourne": { label: "Outer Eastern Melbourne", group: "metro" },
    "north-eastern-melbourne": { label: "North Eastern Melbourne", group: "metro" },
    "hume-merri-bek": { label: "Hume Merri-bek", group: "metro" },
    "brimbank-melton": { label: "Brimbank Melton", group: "metro" },
    "western-melbourne": { label: "Western Melbourne", group: "metro" },
    "wimmera-south-west": { label: "Wimmera South West", group: "south-west" },
    "barwon": { label: "Barwon", group: "south-west" },
    "central-highlands": { label: "Central Highlands", group: "south-west" },
    "outer-gippsland": { label: "Outer Gippsland", group: "south-eastern" },
    "inner-gippsland": { label: "Inner Gippsland", group: "south-eastern" },
    "ovens-murray": { label: "Ovens Murray", group: "north-eastern" },
    "goulburn": { label: "Goulburn", group: "north-eastern" },
    "mallee": { label: "Mallee", group: "north-western" },
    "loddon-campaspe": { label: "Loddon Campaspe", group: "north-western" },
    "grey": { label: "Heads up", group: "grey" }
  };

  var STATUS_LABELS = {
    open: "Open",
    full: "Full",
    discuss: "Call to discuss"
  };

  var EVENT_TYPE_LABELS = {
    secl: "SECL event",
    partnership: "Partnership event",
    other: "Other BYB event"
  };

  // Inline SVG button icons (decorative — aria-hidden; the button text is
  // the accessible label). Stroke uses currentColor so they inherit the
  // button's text colour. Inline SVG markup is CSP-safe (not script).
  var ICONS = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    rsvp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    directions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };
  function iconLabel(icon, label) {
    return ICONS[icon] + "<span>" + label + "</span>";
  }

  // Self-hosted, cookieless click tracking — records only which
  // instrumented link was clicked and when (see LINK_IDS in
  // netlify/functions/_lib/validate.js), nothing about the visitor.
  // Uses sendBeacon so it fires reliably even when the click also
  // navigates away from the page; falls back to a fire-and-forget fetch
  // where sendBeacon isn't available.
  function trackClick(linkId) {
    var payload = JSON.stringify({ linkId: linkId, page: location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/.netlify/functions/track-click",
        new Blob([payload], { type: "application/json" })
      );
      return;
    }
    fetch("/.netlify/functions/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(function () {});
  }

  function wireClickTracking(root) {
    Array.prototype.slice.call((root || document).querySelectorAll("[data-track]")).forEach(function (el) {
      if (el.dataset.trackWired) return;
      el.dataset.trackWired = "1";
      el.addEventListener("click", function () { trackClick(el.getAttribute("data-track")); });
    });
  }

  function fetchEvents() {
    return fetch("events.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load events.json");
        return res.json();
      });
  }

  // Events store dates as "YYYY-MM-DD" strings. Parsing with an explicit
  // time avoids the UTC-midnight shift that plain `new Date("YYYY-MM-DD")`
  // introduces in browsers behind Australian time zones.
  function parseEventDate(dateStr) {
    var parts = dateStr.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Great-circle distance in km between two lat/lng points (haversine),
  // for the "find events near me" sorting. Events already carry lat/lng
  // from geocoding, so no network call is needed to rank them.
  function distanceKm(lat1, lng1, lat2, lng2) {
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(km) {
    if (km < 1) return "under 1 km away";
    if (km < 10) return km.toFixed(1) + " km away";
    return Math.round(km) + " km away";
  }

  // Lazily fetch the compact Victorian postcode -> [lat, lng] lookup only
  // when someone actually uses the postcode search, so the default page
  // stays light.
  var postcodesPromise = null;
  function loadPostcodes() {
    if (!postcodesPromise) {
      postcodesPromise = fetch("assets/vic-postcodes.json").then(function (res) {
        if (!res.ok) throw new Error("Could not load postcodes");
        return res.json();
      });
    }
    return postcodesPromise;
  }

  function dateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatLongDate(d) {
    return d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "long"
    });
  }

  function formatMonthLabel(year, month) {
    return new Date(year, month, 1).toLocaleDateString("en-AU", {
      month: "long",
      year: "numeric"
    });
  }

  function regionChipHtml(region) {
    var meta = REGION_META[region] || { label: region, group: "grey" };
    return '<span class="chip chip-group-' + meta.group + '">' + meta.label + "</span>";
  }

  function statusHtml(status) {
    if (!status || !STATUS_LABELS[status]) return "";
    return '<span class="status status-' + status + '">' + STATUS_LABELS[status] + "</span>";
  }

  function eventTypeChipHtml(eventType) {
    if (!eventType || !EVENT_TYPE_LABELS[eventType]) return "";
    return '<span class="chip chip-eventtype-' + eventType + '">' + EVENT_TYPE_LABELS[eventType] + "</span>";
  }

  function hostChipHtml(host) {
    var isSecl = host === "SECL";
    var cls = "host-chip" + (isSecl ? " host-chip-secl" : "");
    return '<span class="' + cls + '">' + (isSecl ? "SECL" : escapeHtml(host)) + "</span>";
  }

  function stakeholderChipsHtml(stakeholders) {
    if (!stakeholders || !stakeholders.length) return "";
    return stakeholders
      .map(function (org) {
        return '<span class="host-chip">' + escapeHtml(org) + "</span>";
      })
      .join("");
  }

  function alsoAttendingText(ev) {
    if (!ev.stakeholders || !ev.stakeholders.length) return "";
    return " Also attending: " + ev.stakeholders.join(", ") + ".";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // Best-effort parse of the free-text `time` field ("10am to 2pm",
  // "9:30am to 1pm", ...) into 24-hour start/end. Returns null if the
  // text doesn't match a recognisable pattern — callers fall back to an
  // all-day calendar entry in that case rather than guessing.
  function parseTimeRange(timeStr) {
    if (!timeStr) return null;
    var re = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
    var m = timeStr.match(re);
    if (!m) return null;
    function to24(h, min, ap) {
      h = parseInt(h, 10) % 12;
      if (/pm/i.test(ap)) h += 12;
      return { h: h, m: min ? parseInt(min, 10) : 0 };
    }
    return { start: to24(m[1], m[2], m[3]), end: to24(m[4], m[5], m[6]) };
  }

  function icsEscape(str) {
    return String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  // Folds a line at ~74 octets per RFC 5545 §3.1 — most calendar apps
  // tolerate long lines, but folding keeps this correct for strict ones.
  function foldIcsLine(line) {
    if (line.length <= 74) return line;
    var out = line.slice(0, 74);
    var rest = line.slice(74);
    while (rest.length > 0) {
      out += "\r\n " + rest.slice(0, 73);
      rest = rest.slice(73);
    }
    return out;
  }

  function buildIcsForEvent(ev) {
    var dateParts = ev.date.split("-");
    var dateCompact = dateParts.join("");
    var range = parseTimeRange(ev.time);

    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bring Your Bills//BYB Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + ev.id + "@bringyourbills.org.au"
    ];

    var now = new Date();
    lines.push(
      "DTSTAMP:" +
        now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) + "T" +
        pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + "Z"
    );

    if (range) {
      var startStamp = dateCompact + "T" + pad2(range.start.h) + pad2(range.start.m) + "00";
      var endStamp = dateCompact + "T" + pad2(range.end.h) + pad2(range.end.m) + "00";
      lines.push("DTSTART;TZID=Australia/Melbourne:" + startStamp);
      lines.push("DTEND;TZID=Australia/Melbourne:" + endStamp);
    } else {
      var endDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
      endDate.setDate(endDate.getDate() + 1);
      var endCompact = endDate.getFullYear() + pad2(endDate.getMonth() + 1) + pad2(endDate.getDate());
      lines.push("DTSTART;VALUE=DATE:" + dateCompact);
      lines.push("DTEND;VALUE=DATE:" + endCompact);
    }

    lines.push("SUMMARY:" + icsEscape(ev.title));
    var location = [ev.venue, ev.address].filter(Boolean).join(", ");
    if (location) lines.push("LOCATION:" + icsEscape(location));

    var descriptionParts = ["Free · Walk in · No appointment"];
    if (ev.time) descriptionParts.push(ev.time);
    descriptionParts.push("Hosted by " + (ev.host || "SECL"));
    lines.push("DESCRIPTION:" + icsEscape(descriptionParts.join(" - ")));

    lines.push("END:VEVENT");
    lines.push("END:VCALENDAR");

    return lines.map(foldIcsLine).join("\r\n") + "\r\n";
  }

  function downloadIcsForEvent(ev) {
    var blob = new Blob([buildIcsForEvent(ev)], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = ev.id + ".ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var REGION_GROUPS_ORDER = ["metro", "south-west", "south-eastern", "north-eastern", "north-western", "grey"];
  var REGION_GROUP_LABELS = {
    metro: "Metro",
    "south-west": "South West",
    "south-eastern": "South Eastern",
    "north-eastern": "North Eastern",
    "north-western": "North Western",
    grey: "Other"
  };

  // Builds a checkbox list grouped by cluster (all checked by default —
  // "everything shown" is the default state), for the "Filter by region"
  // panel on calendar.html/map.html. Kept here since REGION_META already
  // lives in this file as the single source of truth for region data.
  function buildRegionFilterHtml() {
    var byGroup = {};
    Object.keys(REGION_META).forEach(function (code) {
      var meta = REGION_META[code];
      (byGroup[meta.group] = byGroup[meta.group] || []).push({ code: code, label: meta.label });
    });
    var groupsHtml = REGION_GROUPS_ORDER.filter(function (g) { return byGroup[g]; })
      .map(function (group) {
        var options = byGroup[group]
          .map(function (r) {
            return '<label class="region-filter-option"><input type="checkbox" value="' + r.code + '" checked> ' + escapeHtml(r.label) + "</label>";
          })
          .join("");
        return '<div class="region-filter-group" role="group" aria-label="' + escapeHtml(REGION_GROUP_LABELS[group]) + '"><div class="region-filter-group-title" aria-hidden="true">' + REGION_GROUP_LABELS[group] + "</div>" + options + "</div>";
      })
      .join("");
    return groupsHtml +
      '<div class="region-filter-actions">' +
        "<button type=\"button\" class=\"btn-link\" data-region-filter-all>Select all</button>" +
        "<button type=\"button\" class=\"btn-link\" data-region-filter-none>Clear all</button>" +
      "</div>";
  }

  // Wires the checkboxes inside `panelEl` (plus optional select-all/none
  // buttons) and calls `onChange(selectedRegionCodes)` whenever the
  // selection changes. Returns a `getSelected()` accessor for the
  // initial/current state.
  function wireRegionFilter(panelEl, onChange) {
    function checkboxes() {
      return Array.prototype.slice.call(panelEl.querySelectorAll('input[type="checkbox"]'));
    }
    function getSelected() {
      return checkboxes().filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
    }
    checkboxes().forEach(function (cb) {
      cb.addEventListener("change", function () { onChange(getSelected()); });
    });
    var selectAllBtn = panelEl.querySelector("[data-region-filter-all]");
    var selectNoneBtn = panelEl.querySelector("[data-region-filter-none]");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", function () {
        checkboxes().forEach(function (cb) { cb.checked = true; });
        onChange(getSelected());
      });
    }
    if (selectNoneBtn) {
      selectNoneBtn.addEventListener("click", function () {
        checkboxes().forEach(function (cb) { cb.checked = false; });
        onChange(getSelected());
      });
    }
    return getSelected;
  }

  function upcomingNonGrey(events, from) {
    return events
      .filter(function (ev) {
        return ev.region !== "grey" && parseEventDate(ev.date) >= from;
      })
      .sort(function (a, b) {
        return parseEventDate(a.date) - parseEventDate(b.date);
      });
  }

  /* ---------------- Landing page ---------------- */

  function initLanding(events) {
    var card = document.getElementById("next-event-card");
    if (!card) return;

    var body = card.querySelector(".event-card-body");
    var next = upcomingNonGrey(events, startOfToday())[0];

    if (!next) {
      body.innerHTML =
        '<p class="event-card-empty">No upcoming events are scheduled right now. ' +
        'Email <a href="mailto:byb@secl.org.au">byb@secl.org.au</a> and we will let you know what\'s next.</p>';
      return;
    }

    var mapsHref =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(next.address || ((next.venue || "") + " " + next.title));

    body.innerHTML =
      '<div class="event-card-date">' + escapeHtml(formatLongDate(parseEventDate(next.date))) + "</div>" +
      '<div class="event-card-time">' + escapeHtml(next.time || "") + "</div>" +
      '<div class="event-card-venue">' + escapeHtml(next.venue || "") + "</div>" +
      (next.address ? '<div class="event-card-address">' + escapeHtml(next.address) + "</div>" : "") +
      '<div class="event-card-region">' + regionChipHtml(next.region) + "</div>" +
      '<div class="event-card-actions">' +
        '<a class="btn btn-rsvp btn-block" href="register.html?event=' + encodeURIComponent(next.id) + '" data-track="hero-lets-know-coming">' + iconLabel("rsvp", "Let us know you're coming") + "</a>" +
        '<button type="button" class="btn btn-calendar btn-block" data-add-to-calendar data-track="hero-add-to-calendar">' + iconLabel("calendar", "Add to calendar") + "</button>" +
      "</div>" +
      '<div class="event-card-actions event-card-actions-secondary">' +
        '<a class="btn btn-secondary btn-block" href="' + mapsHref + '" target="_blank" rel="noopener" data-track="hero-get-directions">' + iconLabel("directions", "Get directions") + "</a>" +
        '<a class="btn btn-secondary btn-block" href="calendar.html" data-track="hero-see-all-events">See all events</a>' +
      "</div>" +
      '<div class="event-card-links">' +
        '<a class="btn-link" href="event.html?id=' + encodeURIComponent(next.id) + '" data-track="hero-view-event">' + ICONS.info + "<span>View event details</span></a>" +
        '<a class="btn-link" href="map.html?event=' + encodeURIComponent(next.id) + '" data-track="hero-view-on-map">' + ICONS.map + "<span>View on map</span></a>" +
      "</div>" +
      '<div class="event-card-standing">Free · Walk in · No appointment</div>';

    var icsButton = body.querySelector("[data-add-to-calendar]");
    if (icsButton) icsButton.addEventListener("click", function () { downloadIcsForEvent(next); });
    wireClickTracking(body);
  }

  /* ---------------- Calendar page ---------------- */

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function buildMonthCells(year, month) {
    var firstOfMonth = new Date(year, month, 1);
    var startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();
    var cells = [];

    for (var i = 0; i < startWeekday; i++) {
      var prevDay = daysInPrevMonth - startWeekday + 1 + i;
      cells.push({ date: new Date(year, month - 1, prevDay), outside: true });
    }
    for (var d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), outside: false });
    }
    while (cells.length % 7 !== 0) {
      var last = cells[cells.length - 1].date;
      var next = new Date(last);
      next.setDate(next.getDate() + 1);
      cells.push({ date: next, outside: true });
    }
    return cells;
  }

  // Shared by the full interactive calendar (calendar.html) and the
  // read-only preview grid on the homepage — renders one month's day
  // cells into `grid`, keeping the weekday header row already in it.
  // Returns the number of events found in-month, so callers can toggle
  // their own "no events this month" note.
  function renderMonthGrid(grid, weekdayHeaders, year, month, eventsByDate, today) {
    Array.prototype.slice.call(grid.children).forEach(function (child) {
      if (weekdayHeaders.indexOf(child) === -1) grid.removeChild(child);
    });

    var cells = buildMonthCells(year, month);
    var eventsInMonth = 0;

    cells.forEach(function (cell) {
      var key = dateKey(cell.date);
      var dayEvents = eventsByDate[key] || [];
      if (!cell.outside) eventsInMonth += dayEvents.length;

      var cellEl = document.createElement("div");
      cellEl.className =
        "calendar-day" +
        (cell.outside ? " is-outside" : "") +
        (!cell.outside && sameDay(cell.date, today) ? " is-today" : "");

      var num = document.createElement("div");
      num.className = "day-number";
      num.textContent = cell.date.getDate();
      cellEl.appendChild(num);

      if (dayEvents.length) {
        var list = document.createElement("div");
        list.className = "day-events";
        dayEvents.forEach(function (ev) {
          var pill = document.createElement("span");
          var pillGroup = (REGION_META[ev.region] || { group: "grey" }).group;
          pill.className = "event-pill region-group-" + pillGroup;
          pill.textContent = ev.title;
          pill.title = ev.title + (ev.venue ? " — " + ev.venue : "") + alsoAttendingText(ev);
          list.appendChild(pill);
        });
        cellEl.appendChild(list);
      }

      grid.appendChild(cellEl);
    });

    return eventsInMonth;
  }

  /* ---------------- Homepage calendar preview ---------------- */

  function initHomeCalendarPreview(events) {
    var grid = document.getElementById("home-calendar-grid");
    if (!grid) return;

    var monthLabel = document.getElementById("home-month-label");
    var emptyNote = document.getElementById("home-calendar-empty-note");
    var weekdayHeaders = Array.prototype.slice.call(grid.querySelectorAll(".calendar-weekday"));

    var eventsByDate = {};
    events.forEach(function (ev) {
      (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev);
    });

    var today = startOfToday();
    monthLabel.textContent = formatMonthLabel(today.getFullYear(), today.getMonth());
    var eventsInMonth = renderMonthGrid(grid, weekdayHeaders, today.getFullYear(), today.getMonth(), eventsByDate, today);
    emptyNote.hidden = eventsInMonth > 0;
  }

  function initCalendar(allEvents) {
    var grid = document.getElementById("calendar-grid");
    if (!grid) return;

    var monthLabel = document.getElementById("month-label");
    var prevBtn = document.getElementById("prev-month");
    var nextBtn = document.getElementById("next-month");
    var todayBtn = document.getElementById("today-button");
    var emptyNote = document.getElementById("calendar-empty-note");
    var upcomingList = document.getElementById("upcoming-list");
    var countEl = document.getElementById("upcoming-count");
    var filterPanel = document.getElementById("region-filter-panel");
    var nearMeForm = document.getElementById("near-me-form");
    var nearMePostcode = document.getElementById("near-me-postcode");
    var nearMeGeo = document.getElementById("near-me-geo");
    var nearMeClear = document.getElementById("near-me-clear");
    var nearMeStatus = document.getElementById("near-me-status");

    var totalRegionCount = Object.keys(REGION_META).length;
    var filterActive = false;
    var userLocation = null; // { lat, lng, label } when "near me" is active
    var events = allEvents;
    var eventsByDate = {};

    function recomputeEventsByDate() {
      eventsByDate = {};
      events.forEach(function (ev) {
        (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev);
      });
    }
    recomputeEventsByDate();

    var today = startOfToday();
    var viewYear = today.getFullYear();
    var viewMonth = today.getMonth();

    var weekdayHeaders = Array.prototype.slice.call(
      grid.querySelectorAll(".calendar-weekday")
    );

    if (filterPanel) {
      filterPanel.innerHTML = buildRegionFilterHtml();
      wireRegionFilter(filterPanel, function (selectedRegions) {
        filterActive = selectedRegions.length < totalRegionCount;
        var selectedSet = {};
        selectedRegions.forEach(function (r) { selectedSet[r] = true; });
        events = allEvents.filter(function (ev) { return selectedSet[ev.region]; });
        recomputeEventsByDate();
        renderMonth();
        renderUpcoming();
      });
    }

    function setNearMe(location) {
      userLocation = location;
      if (nearMeClear) nearMeClear.hidden = !location;
      // The upcoming-events count line announces the active sort, so the
      // form's own status can clear once a location resolves (or is cleared).
      if (nearMeStatus) nearMeStatus.textContent = "";
      renderUpcoming();
    }

    if (nearMeForm) {
      nearMeForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var pc = (nearMePostcode.value || "").trim();
        if (!/^\d{4}$/.test(pc)) {
          nearMeStatus.textContent = "Enter a 4-digit Victorian postcode.";
          return;
        }
        nearMeStatus.textContent = "Looking up postcode…";
        loadPostcodes()
          .then(function (map) {
            var coord = map[pc];
            if (!coord) {
              nearMeStatus.textContent = "We don't recognise postcode " + pc + " — try a nearby one, or use your location.";
              return;
            }
            setNearMe({ lat: coord[0], lng: coord[1], label: "postcode " + pc });
          })
          .catch(function () {
            nearMeStatus.textContent = "Couldn't load postcode data right now. Please try again.";
          });
      });
    }

    if (nearMeGeo) {
      if (!navigator.geolocation) {
        nearMeGeo.hidden = true;
      } else {
        nearMeGeo.addEventListener("click", function () {
          nearMeStatus.textContent = "Finding your location…";
          navigator.geolocation.getCurrentPosition(
            function (pos) {
              setNearMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location" });
            },
            function () {
              nearMeStatus.textContent = "Couldn't get your location — enter your postcode instead.";
            },
            { timeout: 10000, maximumAge: 300000 }
          );
        });
      }
    }

    if (nearMeClear) {
      nearMeClear.addEventListener("click", function () {
        if (nearMePostcode) nearMePostcode.value = "";
        setNearMe(null);
      });
    }

    function renderMonth() {
      monthLabel.textContent = formatMonthLabel(viewYear, viewMonth);
      var eventsInMonth = renderMonthGrid(grid, weekdayHeaders, viewYear, viewMonth, eventsByDate, today);
      emptyNote.hidden = eventsInMonth > 0;
    }

    function renderUpcoming() {
      var upcoming = upcomingNonGrey(events, today);

      // "Near me": annotate each event with its distance and sort nearest
      // first. Events without coordinates keep their date order and go last.
      var located = 0;
      if (userLocation) {
        upcoming = upcoming.slice().map(function (ev) {
          var km = (typeof ev.lat === "number" && typeof ev.lng === "number")
            ? distanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng)
            : null;
          if (km !== null) located += 1;
          return { ev: ev, km: km };
        }).sort(function (a, b) {
          if (a.km === null && b.km === null) return 0;
          if (a.km === null) return 1;
          if (b.km === null) return -1;
          return a.km - b.km;
        }).map(function (x) { x.ev._distanceKm = x.km; return x.ev; });
      } else {
        upcoming.forEach(function (ev) { ev._distanceKm = null; });
      }

      if (countEl) {
        if (!upcoming.length) {
          countEl.textContent = filterActive
            ? "No upcoming events match the regions you've selected."
            : "No upcoming events scheduled.";
        } else if (userLocation) {
          countEl.textContent =
            "Showing " + upcoming.length + " upcoming event" + (upcoming.length === 1 ? "" : "s") +
            ", nearest to " + userLocation.label + " first" +
            (located < upcoming.length ? " (" + (upcoming.length - located) + " without a mapped location, listed last)" : "") + ".";
        } else {
          countEl.textContent =
            "Showing " + upcoming.length + " upcoming event" + (upcoming.length === 1 ? "" : "s") +
            (filterActive ? " in the regions you've selected." : ".");
        }
      }

      if (!upcoming.length) {
        upcomingList.innerHTML = filterActive
          ? '<li class="upcoming-item"><p class="event-card-empty">No upcoming events match the regions you\'ve selected. ' +
            'Open <strong>Filter by region</strong> above and choose <strong>Select all</strong> to see every event.</p></li>'
          : '<li class="upcoming-item"><p class="event-card-empty">No upcoming events are scheduled right now. ' +
            'Email <a href="mailto:byb@secl.org.au">byb@secl.org.au</a> and we will let you know what\'s next.</p></li>';
        return;
      }

      upcomingList.innerHTML = upcoming
        .map(function (ev) {
          var distanceHtml = (ev._distanceKm !== null && ev._distanceKm !== undefined)
            ? '<div class="upcoming-distance">' + escapeHtml(formatDistance(ev._distanceKm)) + "</div>"
            : "";
          return (
            '<li class="upcoming-item">' +
              '<div class="upcoming-item-top">' +
                '<span class="upcoming-date">' + escapeHtml(formatLongDate(parseEventDate(ev.date))) + "</span>" +
                statusHtml(ev.status) +
              "</div>" +
              '<div class="upcoming-title">' + escapeHtml(ev.title) + "</div>" +
              '<div class="upcoming-meta">' +
                escapeHtml(ev.venue || "") + (ev.venue && ev.time ? " · " : "") + escapeHtml(ev.time || "") +
              "</div>" +
              (ev.address ? '<div class="upcoming-address">' + escapeHtml(ev.address) + "</div>" : "") +
              distanceHtml +
              '<div class="upcoming-chips">' + regionChipHtml(ev.region) + hostChipHtml(ev.host) + stakeholderChipsHtml(ev.stakeholders) + "</div>" +
              '<div class="upcoming-standing">Free · Walk in · No appointment</div>' +
              '<div class="upcoming-actions">' +
                '<a class="btn btn-rsvp btn-sm" href="register.html?event=' + encodeURIComponent(ev.id) + '" data-track="upcoming-lets-know-coming">' + iconLabel("rsvp", "Let us know you're coming") + "</a>" +
                '<button type="button" class="btn btn-calendar btn-sm" data-add-to-calendar="' + escapeHtml(ev.id) + '" data-track="upcoming-add-to-calendar">' + iconLabel("calendar", "Add to calendar") + "</button>" +
              "</div>" +
              '<div class="event-card-links">' +
                '<a class="btn-link" href="event.html?id=' + encodeURIComponent(ev.id) + '" data-track="upcoming-view-event">' + ICONS.info + "<span>View event details</span></a>" +
                '<a class="btn-link" href="map.html?event=' + encodeURIComponent(ev.id) + '" data-track="upcoming-view-on-map">' + ICONS.map + "<span>View on map</span></a>" +
              "</div>" +
            "</li>"
          );
        })
        .join("");

      Array.prototype.slice.call(upcomingList.querySelectorAll("[data-add-to-calendar]")).forEach(function (btn) {
        var ev = upcoming.find(function (e) { return e.id === btn.getAttribute("data-add-to-calendar"); });
        if (ev) btn.addEventListener("click", function () { downloadIcsForEvent(ev); });
      });
      wireClickTracking(upcomingList);
    }

    prevBtn.addEventListener("click", function () {
      viewMonth -= 1;
      if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
      renderMonth();
    });
    nextBtn.addEventListener("click", function () {
      viewMonth += 1;
      if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
      renderMonth();
    });
    todayBtn.addEventListener("click", function () {
      viewYear = today.getFullYear();
      viewMonth = today.getMonth();
      renderMonth();
    });

    renderMonth();
    renderUpcoming();
  }

  /* ---------------- Boot ---------------- */

  wireClickTracking(document);

  fetchEvents()
    .then(function (events) {
      initLanding(events);
      initHomeCalendarPreview(events);
      initCalendar(events);
    })
    .catch(function () {
      var card = document.getElementById("next-event-card");
      if (card) {
        card.querySelector(".event-card-body").innerHTML =
          '<p class="event-card-empty">We couldn\'t load event details right now. ' +
          'Email <a href="mailto:byb@secl.org.au">byb@secl.org.au</a> for the latest dates.</p>';
      }
      var upcomingList = document.getElementById("upcoming-list");
      if (upcomingList) {
        upcomingList.innerHTML =
          '<li class="upcoming-item"><p class="event-card-empty">We couldn\'t load event details right now. ' +
          'Email <a href="mailto:byb@secl.org.au">byb@secl.org.au</a> for the latest dates.</p></li>';
      }
    });

  // Small shared API for other pages that load this script (currently
  // map.js) so region colours, date parsing and ICS generation stay in
  // one place rather than being duplicated per page.
  window.BYB = {
    REGION_META: REGION_META,
    escapeHtml: escapeHtml,
    regionChipHtml: regionChipHtml,
    statusHtml: statusHtml,
    hostChipHtml: hostChipHtml,
    stakeholderChipsHtml: stakeholderChipsHtml,
    eventTypeChipHtml: eventTypeChipHtml,
    parseEventDate: parseEventDate,
    startOfToday: startOfToday,
    formatLongDate: formatLongDate,
    formatMonthLabel: formatMonthLabel,
    upcomingNonGrey: upcomingNonGrey,
    buildIcsForEvent: buildIcsForEvent,
    downloadIcsForEvent: downloadIcsForEvent,
    wireClickTracking: wireClickTracking,
    buildRegionFilterHtml: buildRegionFilterHtml,
    wireRegionFilter: wireRegionFilter,
    ICONS: ICONS,
    iconLabel: iconLabel
  };
})();
