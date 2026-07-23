(function () {
  "use strict";

  var form = document.getElementById("request-form");
  var actionSelect = document.getElementById("action");
  var fieldsTarget = document.getElementById("fields-target");
  var fieldsEvent = document.getElementById("fields-event");
  var fieldsAttend = document.getElementById("fields-attend");
  var fieldsService = document.getElementById("fields-service");
  var targetSelect = document.getElementById("targetId");
  var attendingServiceSelect = document.getElementById("attending-service");
  var submitButton = document.getElementById("submit-button");
  var successMessage = document.getElementById("success-message");
  var errorMessage = document.getElementById("error-message");

  var SERVICE_LOGO_MAX_BYTES = 500 * 1024; // keep in sync with _lib/validate.js

  var events = [];

  function loadEvents() {
    fetch("events.json")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        events = data.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
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

  function loadServices() {
    fetch("services.json")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var services = data.slice().sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
        attendingServiceSelect.innerHTML = services.length
          ? services.map(function (s) { return '<option value="' + escapeHtml(s.name) + '">' + escapeHtml(s.name) + "</option>"; }).join("")
          : '<option value="">No services yet — add one first</option>';
      })
      .catch(function () {
        attendingServiceSelect.innerHTML = '<option value="">Couldn\'t load services — try refreshing the page</option>';
      });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = function () { reject(new Error("Couldn't read that logo file. Please try again.")); };
      reader.readAsDataURL(file);
    });
  }

  function updateVisibleFields() {
    var action = actionSelect.value;
    var needsTarget = action === "edit" || action === "delete" || action === "attend";
    var needsEventFields = action === "add" || action === "edit";
    var needsAttendFields = action === "attend";
    var needsServiceFields = action === "add-service";

    fieldsTarget.hidden = !needsTarget;
    fieldsTarget.disabled = !needsTarget;
    fieldsEvent.hidden = !needsEventFields;
    fieldsEvent.disabled = !needsEventFields;
    fieldsAttend.hidden = !needsAttendFields;
    fieldsAttend.disabled = !needsAttendFields;
    fieldsService.hidden = !needsServiceFields;
    fieldsService.disabled = !needsServiceFields;
  }

  actionSelect.addEventListener("change", updateVisibleFields);
  updateVisibleFields();
  loadEvents();
  loadServices();

  function showMessage(el, text) {
    successMessage.hidden = true;
    errorMessage.hidden = true;
    el.textContent = text;
    el.hidden = false;
    el.scrollIntoView({ block: "nearest" });
  }

  function doSubmit(payload) {
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
        loadServices();
        if (result.data.warning) {
          showMessage(successMessage, result.data.warning);
        } else if (result.data.autoApproved) {
          showMessage(successMessage, "Done — this is now live on the calendar.");
        } else {
          showMessage(
            successMessage,
            "Thanks — your request has been sent to SECL for review. We'll follow up at the email you provided."
          );
        }
      })
      .catch(function (err) {
        showMessage(errorMessage, err.message || "Something went wrong. Please try again, or email byb@secl.org.au.");
      })
      .finally(function () {
        submitButton.disabled = false;
        submitButton.textContent = "Send request";
      });
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
        address: document.getElementById("event-address").value,
        region: document.getElementById("event-region").value,
        status: document.getElementById("event-region").value === "grey"
          ? ""
          : document.getElementById("event-status").value,
        host: document.getElementById("event-host").value,
        time: document.getElementById("event-time").value,
        eventType: document.getElementById("event-type").value
      };
    }
    if (action === "edit" || action === "delete" || action === "attend") {
      payload.targetId = targetSelect.value;
    }
    if (action === "attend") {
      payload.attendingService = attendingServiceSelect.value;
    }

    if (action === "add-service") {
      var logoFile = document.getElementById("service-logo").files[0];
      if (!logoFile) {
        showMessage(errorMessage, "Choose a logo file.");
        return;
      }
      if (logoFile.size > SERVICE_LOGO_MAX_BYTES) {
        showMessage(errorMessage, "Logo image must be under " + Math.round(SERVICE_LOGO_MAX_BYTES / 1024) + "KB.");
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = "Reading logo…";
      fileToBase64(logoFile)
        .then(function (base64) {
          payload.service = {
            name: document.getElementById("service-name").value,
            logoBase64: base64,
            logoMimeType: logoFile.type
          };
          doSubmit(payload);
        })
        .catch(function (err) {
          submitButton.disabled = false;
          submitButton.textContent = "Send request";
          showMessage(errorMessage, err.message);
        });
      return;
    }

    doSubmit(payload);
  });
})();
