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

  var passcode = null;
  var eventsById = {};

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
        if (r.contact) bits.push(escapeHtml(r.contact));
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

  var saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    passcode = saved;
    loadEventsThenRegistrations();
  }

  window.addEventListener("beforeunload", function () {
    if (passcode) sessionStorage.setItem(STORAGE_KEY, passcode);
  });
})();
