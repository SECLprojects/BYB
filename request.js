(function () {
  "use strict";

  var form = document.getElementById("request-form");
  var actionSelect = document.getElementById("action");
  var fieldsTarget = document.getElementById("fields-target");
  var fieldsEvent = document.getElementById("fields-event");
  var targetSelect = document.getElementById("targetId");
  var submitButton = document.getElementById("submit-button");
  var successMessage = document.getElementById("success-message");
  var errorMessage = document.getElementById("error-message");

  var events = [];

  function loadEvents() {
    fetch("events.json")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        events = data.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
        targetSelect.innerHTML = events
          .map(function (ev) {
            var label = ev.date + " — " + ev.title + (ev.venue ? " (" + ev.venue + ")" : "");
            return '<option value="' + ev.id + '">' + escapeHtml(label) + "</option>";
          })
          .join("");
      })
      .catch(function () {
        targetSelect.innerHTML = '<option value="">Couldn\'t load events — try refreshing the page</option>';
      });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function updateVisibleFields() {
    var action = actionSelect.value;
    var needsTarget = action === "edit" || action === "delete" || action === "attend";
    var needsEventFields = action === "add" || action === "edit";

    fieldsTarget.hidden = !needsTarget;
    fieldsEvent.hidden = !needsEventFields;
  }

  actionSelect.addEventListener("change", updateVisibleFields);
  updateVisibleFields();
  loadEvents();

  function showMessage(el, text) {
    successMessage.hidden = true;
    errorMessage.hidden = true;
    el.textContent = text;
    el.hidden = false;
    el.scrollIntoView({ block: "nearest" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!form.reportValidity()) return;

    var action = actionSelect.value;
    var payload = {
      passcode: document.getElementById("passcode").value,
      action: action,
      name: document.getElementById("name").value,
      organisation: document.getElementById("organisation").value,
      email: document.getElementById("email").value,
      note: document.getElementById("note").value
    };

    if (action === "add" || action === "edit") {
      payload.event = {
        date: document.getElementById("event-date").value,
        title: document.getElementById("event-title").value,
        venue: document.getElementById("event-venue").value,
        region: document.getElementById("event-region").value,
        status: document.getElementById("event-region").value === "grey"
          ? ""
          : document.getElementById("event-status").value,
        host: document.getElementById("event-host").value,
        time: document.getElementById("event-time").value
      };
    }
    if (action === "edit" || action === "delete" || action === "attend") {
      payload.targetId = targetSelect.value;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    fetch("/.netlify/functions/submit-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () { return {}; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.data.error || "Something went wrong. Please try again, or email byb@secl.org.au.");
        }
        form.reset();
        updateVisibleFields();
        showMessage(
          successMessage,
          "Thanks — your request has been sent to SECL for review. We'll follow up at the email you provided."
        );
      })
      .catch(function (err) {
        showMessage(errorMessage, err.message || "Something went wrong. Please try again, or email byb@secl.org.au.");
      })
      .finally(function () {
        submitButton.disabled = false;
        submitButton.textContent = "Send request";
      });
  });
})();
