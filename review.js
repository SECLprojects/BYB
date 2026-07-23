(function () {
  "use strict";

  var STORAGE_KEY = "byb-staff-passcode";

  var gate = document.getElementById("passcode-gate");
  var gateError = document.getElementById("gate-error");
  var passcodeInput = document.getElementById("staff-passcode");
  var unlockButton = document.getElementById("unlock-button");
  var queueSection = document.getElementById("queue-section");
  var pendingList = document.getElementById("pending-list");
  var pendingEmpty = document.getElementById("pending-empty");
  var decidedList = document.getElementById("decided-list");
  var decidedEmpty = document.getElementById("decided-empty");
  var refreshButton = document.getElementById("refresh-button");

  var passcode = null;

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function fieldRow(label, value) {
    if (!value) return "";
    return "<dt>" + escapeHtml(label) + ":</dt><dd>" + escapeHtml(value) + "</dd> ";
  }

  function describeRequest(r) {
    if (r.action === "add" || r.action === "edit") {
      var ev = r.event || {};
      return (
        fieldRow("Date", ev.date) +
        fieldRow("Title", ev.title) +
        fieldRow("Venue", ev.venue) +
        fieldRow("Address", ev.address) +
        fieldRow("Region", ev.region) +
        fieldRow("Status", ev.status) +
        fieldRow("Host", ev.host) +
        fieldRow("Time", ev.time)
      );
    }
    if (r.action === "delete") {
      return fieldRow("Event id", r.targetId);
    }
    if (r.action === "attend") {
      var attendingAs = (r.event && r.event.attendingService) || r.organisation;
      return fieldRow("Event id", r.targetId) + fieldRow("Attending as", attendingAs);
    }
    if (r.action === "add-service") {
      return fieldRow("Service name", r.event && r.event.name);
    }
    return "";
  }

  function servicePreviewHtml(r) {
    if (r.action !== "add-service" || !r.event || !r.event.logoBase64 || !r.event.logoMimeType) return "";
    // Only render if the payload is genuinely a base64 image — mirrors the
    // server-side validation, so a malformed/tampered value never reaches
    // the data: URI. escapeHtml on the src is belt-and-braces.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(r.event.logoBase64)) return "";
    if (["image/png", "image/jpeg", "image/webp"].indexOf(r.event.logoMimeType) === -1) return "";
    var src = "data:" + r.event.logoMimeType + ";base64," + r.event.logoBase64;
    return '<img class="request-logo-preview" src="' + escapeHtml(src) + '" alt="Logo preview for ' + escapeHtml(r.event.name || "") + '">';
  }

  function renderPending() {
    fetch("/.netlify/functions/list-pending", {
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
        if (!result.ok) throw new Error(result.data.error || "Couldn't load requests. Please try again shortly.");

        var requests = result.data.requests || [];
        var pending = requests.filter(function (r) { return r.status === "pending"; });
        var decided = requests.filter(function (r) { return r.status !== "pending"; }).slice(0, 30);

        pendingEmpty.hidden = pending.length > 0;
        pendingList.innerHTML = pending.map(renderPendingCard).join("");

        decidedEmpty.hidden = decided.length > 0;
        decidedList.innerHTML = decided.map(renderDecidedCard).join("");

        Array.prototype.slice.call(pendingList.querySelectorAll("[data-decide]")).forEach(function (btn) {
          btn.addEventListener("click", onDecide);
        });

        gate.hidden = true;
        queueSection.hidden = false;
      })
      .catch(function (err) {
        gateError.textContent = err.message;
        gateError.hidden = false;
        sessionStorage.removeItem(STORAGE_KEY);
      });
  }

  function renderPendingCard(r) {
    return (
      '<div class="request-card" data-id="' + escapeHtml(r.id) + '">' +
        '<div class="request-card-top">' +
          '<span class="request-action">' + escapeHtml(r.action) + " request</span>" +
          '<span class="request-submitted">' + escapeHtml(new Date(r.submittedAt).toLocaleString("en-AU")) + "</span>" +
        "</div>" +
        '<dl class="request-detail">' + describeRequest(r) + "</dl>" +
        servicePreviewHtml(r) +
        '<div class="request-detail">From ' + escapeHtml(r.name) + " (" + escapeHtml(r.organisation) + "), " +
          '<a href="mailto:' + escapeHtml(r.email) + '">' + escapeHtml(r.email) + "</a></div>" +
        (r.note ? '<div class="request-note">' + escapeHtml(r.note) + "</div>" : "") +
        '<div class="request-actions">' +
          '<button type="button" class="btn btn-sm btn-approve" data-decide="approve" data-id="' + escapeHtml(r.id) + '">Approve</button>' +
          '<button type="button" class="btn btn-sm btn-reject" data-decide="reject" data-id="' + escapeHtml(r.id) + '">Reject</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderDecidedCard(r) {
    return (
      '<div class="request-card">' +
        '<div class="request-card-top">' +
          '<span class="request-action">' + escapeHtml(r.action) + " request</span>" +
          '<span class="request-status request-status-' + escapeHtml(r.status) + '">' + escapeHtml(r.status) + "</span>" +
        "</div>" +
        '<dl class="request-detail">' + describeRequest(r) + "</dl>" +
        servicePreviewHtml(r) +
        '<div class="request-detail">From ' + escapeHtml(r.name) + " (" + escapeHtml(r.organisation) + ")</div>" +
      "</div>"
    );
  }

  function onDecide(e) {
    var btn = e.currentTarget;
    var id = btn.getAttribute("data-id");
    var decision = btn.getAttribute("data-decide");
    var card = pendingList.querySelector('.request-card[data-id="' + CSS.escape(id) + '"]');
    var buttons = card ? card.querySelectorAll("button") : [];

    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });

    fetch("/.netlify/functions/decide-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: passcode, id: id, decision: decision })
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () { return {}; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "Couldn't save that decision. Please try again.");
        renderPending();
      })
      .catch(function (err) {
        alert(err.message);
        Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
      });
  }

  function unlock() {
    var value = passcodeInput.value.trim();
    if (!value) return;
    passcode = value;
    gateError.hidden = true;
    renderPending();
  }

  unlockButton.addEventListener("click", unlock);
  passcodeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") unlock();
  });
  refreshButton.addEventListener("click", renderPending);

  var saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    passcode = saved;
    renderPending();
  }

  // Only remember the passcode for this browser tab's session — never
  // persisted beyond that.
  window.addEventListener("beforeunload", function () {
    if (passcode) sessionStorage.setItem(STORAGE_KEY, passcode);
  });
})();
