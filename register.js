(function () {
  "use strict";

  var form = document.getElementById("register-form");
  var eventSelect = document.getElementById("eventId");
  var needsInterpreter = document.getElementById("needsInterpreter");
  var interpreterLanguageField = document.getElementById("interpreter-language-field");
  var submitButton = document.getElementById("submit-button");
  var successMessage = document.getElementById("success-message");
  var errorMessage = document.getElementById("error-message");

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function loadEvents() {
    fetch("events.json")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var upcoming = data
          .filter(function (ev) {
            var parts = ev.date.split("-").map(Number);
            var d = new Date(parts[0], parts[1] - 1, parts[2]);
            return ev.region !== "grey" && d >= today;
          })
          .sort(function (a, b) { return a.date.localeCompare(b.date); });

        eventSelect.innerHTML = upcoming
          .map(function (ev) {
            var label = ev.date + " — " + ev.title + (ev.venue ? " (" + ev.venue + ")" : "");
            return '<option value="' + escapeHtml(ev.id) + '">' + escapeHtml(label) + "</option>";
          })
          .join("");

        var preselect = getQueryParam("event");
        if (preselect && upcoming.some(function (ev) { return ev.id === preselect; })) {
          eventSelect.value = preselect;
        }
      })
      .catch(function () {
        eventSelect.innerHTML = '<option value="">Couldn\'t load events — try refreshing the page</option>';
      });
  }

  loadEvents();

  needsInterpreter.addEventListener("change", function () {
    interpreterLanguageField.hidden = !needsInterpreter.checked;
  });

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

    var billCategories = Array.prototype.slice
      .call(form.querySelectorAll('input[name="billCategories"]:checked'))
      .map(function (el) { return el.value; });

    var payload = {
      eventId: eventSelect.value,
      name: document.getElementById("name").value,
      contact: document.getElementById("contact").value,
      partySize: document.getElementById("partySize").value,
      billCategories: billCategories,
      needsInterpreter: needsInterpreter.checked,
      interpreterLanguage: document.getElementById("interpreterLanguage").value,
      website: document.getElementById("website").value
    };

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    fetch("/.netlify/functions/submit-registration", {
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
          throw new Error(result.data.error || "Something went wrong. Please try again, or just walk in on the day.");
        }
        form.reset();
        interpreterLanguageField.hidden = true;
        showMessage(successMessage, "Thanks for letting us know — we'll have a spot ready. See you there!");
      })
      .catch(function (err) {
        showMessage(errorMessage, err.message || "Something went wrong. Please try again, or just walk in on the day.");
      })
      .finally(function () {
        submitButton.disabled = false;
        submitButton.textContent = "Let us know you're coming";
      });
  });
})();
