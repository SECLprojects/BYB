(function () {
  "use strict";

  var STORAGE_KEY = "byb-staff-passcode";

  var BILL_LABELS = {
    energy: "Energy bill",
    water: "Water bill",
    "phone-internet": "Phone / internet bill",
    other: "Something else",
    "not-sure": "Not sure yet"
  };

  var gate = document.getElementById("passcode-gate");
  var gateError = document.getElementById("gate-error");
  var passcodeInput = document.getElementById("staff-passcode");
  var unlockButton = document.getElementById("unlock-button");
  var resultsSection = document.getElementById("results-section");
  var eventGroupsEl = document.getElementById("event-groups");
  var resultsEmpty = document.getElementById("results-empty");
  var refreshButton = document.getElementById("refresh-button");
  var exportButton = document.getElementById("export-button");
  var clickStatsSection = document.getElementById("click-stats-section");
  var clickStatsEl = document.getElementById("click-stats");

  var passcode = null;
  var eventsById = {};
  var lastRegistrations = [];

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function billLabel(code) {
    return BILL_LABELS[code] || code;
  }

  function loadEventsThenRegistrations() {
    fetch("events.json")
      .then(function (res) { return res.json(); })
      .then(function (events) {
        eventsById = {};
        events.forEach(function (ev) { eventsById[ev.id] = ev; });
        return renderRegistrations();
      })
      .catch(function () {
        eventsById = {};
        return renderRegistrations();
      });
  }

  function renderRegistrations() {
    return fetch("/.netlify/functions/list-registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: passcode })
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () { return {}; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "Couldn't load registrations.");

        var registrations = result.data.registrations || [];
        lastRegistrations = registrations;
        var groups = {};
        registrations.forEach(function (r) {
          (groups[r.eventId] = groups[r.eventId] || []).push(r);
        });

        var eventIds = Object.keys(groups).sort(function (a, b) {
          var da = (eventsById[a] || {}).date || "";
          var db = (eventsById[b] || {}).date || "";
          return da.localeCompare(db);
        });

        resultsEmpty.hidden = eventIds.length > 0;
        eventGroupsEl.innerHTML = eventIds.map(function (id) { return renderEventGroup(id, groups[id]); }).join("");

        gate.hidden = true;
        resultsSection.hidden = false;
        exportButton.hidden = registrations.length === 0;

        return loadClickStats();
      })
      .catch(function (err) {
        gateError.textContent = err.message;
        gateError.hidden = false;
        sessionStorage.removeItem(STORAGE_KEY);
      });
  }

  function renderEventGroup(eventId, registrations) {
    var ev = eventsById[eventId];
    var title = ev ? ev.date + " — " + ev.title + (ev.venue ? " (" + ev.venue + ")" : "") : "Unknown event (" + eventId + ")";

    var totalPeople = registrations.reduce(function (sum, r) { return sum + (r.partySize || 1); }, 0);
    var interpreterCount = registrations.filter(function (r) { return r.needsInterpreter; }).length;

    var categoryCounts = {};
    registrations.forEach(function (r) {
      (r.billCategories || []).forEach(function (c) {
        categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      });
    });
    var categorySummary = Object.keys(categoryCounts)
      .map(function (c) { return billLabel(c) + " (" + categoryCounts[c] + ")"; })
      .join(", ");

    var rows = registrations
      .map(function (r) {
        var bits = [];
        if (r.name) bits.push(escapeHtml(r.name));
        if (r.phone) bits.push(escapeHtml(r.phone));
        if (r.email) bits.push(escapeHtml(r.email));
        if (r.contact) bits.push(escapeHtml(r.contact));
        if (r.contactConsent) bits.push('<span class="host-chip">OK to contact re future events</span>');
        var who = bits.length ? bits.join(" · ") : "(no name/contact given)";
        var cats = (r.billCategories || []).map(billLabel).join(", ") || "—";
        var interp = r.needsInterpreter ? "Interpreter: " + (escapeHtml(r.interpreterLanguage) || "yes") : "";
        return (
          '<div class="request-card">' +
            '<div class="request-card-top">' +
              '<span class="request-action">' + (r.partySize || 1) + (r.partySize === 1 ? " person" : " people") + "</span>" +
              '<span class="request-submitted">' + escapeHtml(new Date(r.submittedAt).toLocaleString("en-AU")) + "</span>" +
            "</div>" +
            '<div class="request-detail">' + who + "</div>" +
            '<div class="request-detail">' + escapeHtml(cats) + "</div>" +
            (interp ? '<div class="request-note">' + interp + "</div>" : "") +
          "</div>"
        );
      })
      .join("");

    return (
      '<div style="margin-bottom:36px;">' +
        '<h3 style="font-size:19px;font-weight:700;color:var(--ink);margin-bottom:6px;">' + escapeHtml(title) + "</h3>" +
        '<p class="section-lede" style="margin-bottom:16px;">' +
          totalPeople + (totalPeople === 1 ? " person" : " people") + " across " + registrations.length + " " +
          (registrations.length === 1 ? "registration" : "registrations") +
          (interpreterCount ? " · " + interpreterCount + " need" + (interpreterCount === 1 ? "s" : "") + " an interpreter" : "") +
          (categorySummary ? " · " + escapeHtml(categorySummary) : "") +
        "</p>" +
        rows +
      "</div>"
    );
  }

  function loadClickStats() {
    if (!clickStatsEl) return;
    if (clickStatsSection) clickStatsSection.hidden = false;
    return fetch("/.netlify/functions/list-click-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: passcode })
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () { return {}; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) return;
        var stats = (result.data.stats || []).slice().sort(function (a, b) { return b.totalClicks - a.totalClicks; });
        if (!stats.length) {
          clickStatsEl.innerHTML = '<p class="event-card-empty">No link clicks recorded yet.</p>';
          return;
        }
        clickStatsEl.innerHTML =
          '<table style="width:100%;border-collapse:collapse;">' +
            "<thead><tr>" +
              '<th style="text-align:left;padding:6px 10px 6px 0;border-bottom:1px solid var(--card-border-soft);">Link</th>' +
              '<th style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--card-border-soft);">Clicks</th>' +
              '<th style="text-align:left;padding:6px 0 6px 10px;border-bottom:1px solid var(--card-border-soft);">Last clicked</th>' +
            "</tr></thead><tbody>" +
            stats.map(function (s) {
              return "<tr>" +
                '<td style="padding:6px 10px 6px 0;">' + escapeHtml(s.linkId) + "</td>" +
                '<td style="text-align:right;padding:6px 10px;">' + s.totalClicks + "</td>" +
                '<td style="padding:6px 0 6px 10px;">' + escapeHtml(new Date(s.lastClickedAt).toLocaleString("en-AU")) + "</td>" +
              "</tr>";
            }).join("") +
          "</tbody></table>";
      })
      .catch(function () {});
  }

  function csvField(value) {
    var str = value == null ? "" : String(value);
    return '"' + str.replace(/"/g, '""') + '"';
  }

  function exportRegistrationsCsv() {
    var header = [
      "Event date", "Event title", "Submitted at", "Name", "Phone", "Email",
      "OK to contact re future events", "Party size", "Bill categories", "Needs interpreter", "Interpreter language"
    ];
    var lines = [header.map(csvField).join(",")];

    lastRegistrations.forEach(function (r) {
      var ev = eventsById[r.eventId];
      lines.push([
        ev ? ev.date : "",
        ev ? ev.title : r.eventId,
        new Date(r.submittedAt).toLocaleString("en-AU"),
        r.name || "",
        r.phone || "",
        r.email || "",
        r.contactConsent ? "Yes" : "No",
        r.partySize || 1,
        (r.billCategories || []).map(billLabel).join("; "),
        r.needsInterpreter ? "Yes" : "No",
        r.interpreterLanguage || ""
      ].map(csvField).join(","));
    });

    var blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "byb-registrations-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function unlock() {
    var value = passcodeInput.value.trim();
    if (!value) return;
    passcode = value;
    gateError.hidden = true;
    loadEventsThenRegistrations();
  }

  unlockButton.addEventListener("click", unlock);
  passcodeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") unlock();
  });
  refreshButton.addEventListener("click", loadEventsThenRegistrations);
  if (exportButton) exportButton.addEventListener("click", exportRegistrationsCsv);

  var saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    passcode = saved;
    loadEventsThenRegistrations();
  }

  window.addEventListener("beforeunload", function () {
    if (passcode) sessionStorage.setItem(STORAGE_KEY, passcode);
  });
})();
