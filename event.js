(function () {
  "use strict";

  var container = document.getElementById("event-detail");
  if (!container) return;

  var BYB = window.BYB;

  function escapeHtml(str) {
    return BYB.escapeHtml(str);
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // Up to two initials from a service name, for the placeholder shown when
  // a service has no logo in the directory yet.
  function initials(name) {
    var words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  var eventId = getQueryParam("id");

  function notFound(message) {
    container.innerHTML =
      '<h1 class="section-title">Event not found</h1>' +
      '<p class="event-card-empty">' + message + ' <a href="calendar.html">See the full calendar</a> instead.</p>';
  }

  if (!eventId) {
    notFound("No event was specified.");
    return;
  }

  Promise.all([
    fetch("events.json").then(function (res) { return res.json(); }),
    fetch("services.json").then(function (res) { return res.json(); }).catch(function () { return []; })
  ])
    .then(function (results) {
      var events = results[0];
      var services = results[1];
      var ev = events.find(function (e) { return e.id === eventId; });

      if (!ev) {
        notFound("We couldn't find that event — it may have been removed, or the link is out of date.");
        return;
      }

      document.title = ev.title + " | Bring Your Bills";

      var servicesByName = {};
      services.forEach(function (s) { servicesByName[s.name] = s; });

      var attendingNames = [];
      if (ev.host) attendingNames.push(ev.host);
      (ev.stakeholders || []).forEach(function (name) {
        if (attendingNames.indexOf(name) === -1) attendingNames.push(name);
      });
      attendingNames.sort(function (a, b) { return String(a || "").localeCompare(String(b || "")); });

      var servicesListHtml = attendingNames
        .map(function (name) {
          var svc = servicesByName[name];
          var logoHtml = svc
            ? '<img class="event-service-logo" src="' + escapeHtml(svc.logo) + '" alt="">'
            : '<span class="event-service-logo-placeholder" aria-hidden="true">' + escapeHtml(initials(name)) + "</span>";
          return '<li class="event-service-item">' + logoHtml + "<span>" + escapeHtml(name) + "</span></li>";
        })
        .join("");

      var mapsHref =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(ev.address || ((ev.venue || "") + " " + ev.title));

      container.innerHTML =
        '<div class="event-detail-date">' + escapeHtml(BYB.formatLongDate(BYB.parseEventDate(ev.date))) + "</div>" +
        '<h1 class="section-title">' + escapeHtml(ev.title) + "</h1>" +
        '<div class="event-detail-chips">' + BYB.regionChipHtml(ev.region) + BYB.eventTypeChipHtml(ev.eventType) + BYB.statusHtml(ev.status) + "</div>" +
        '<div class="event-detail-meta">' +
          (ev.time ? "<div>" + escapeHtml(ev.time) + "</div>" : "") +
          (ev.venue ? "<div>" + escapeHtml(ev.venue) + "</div>" : "") +
          (ev.address ? "<div>" + escapeHtml(ev.address) + "</div>" : "") +
        "</div>" +
        '<div class="event-detail-standing">Free · Walk in · No appointment</div>' +
        '<div class="event-detail-actions">' +
          '<a class="btn btn-primary" href="' + mapsHref + '" target="_blank" rel="noopener" data-track="event-get-directions">Get directions</a>' +
          '<button type="button" class="btn btn-calendar" id="event-add-to-calendar" data-track="event-add-to-calendar">+ Add to calendar</button>' +
          '<a class="btn btn-rsvp" href="register.html?event=' + encodeURIComponent(ev.id) + '" data-track="event-lets-know-coming">Let us know you\'re coming</a>' +
          '<a class="btn btn-secondary" href="map.html?event=' + encodeURIComponent(ev.id) + '" data-track="event-view-on-map">View on map</a>' +
        "</div>" +
        (attendingNames.length
          ? '<div class="event-detail-services">' +
              '<h2 class="section-title" style="font-size:19px;">Services at this event</h2>' +
              '<p class="section-lede">The following services will be here, listed alphabetically.</p>' +
              '<ul class="event-service-list">' + servicesListHtml + "</ul>" +
            "</div>"
          : "");

      var icsButton = document.getElementById("event-add-to-calendar");
      if (icsButton) icsButton.addEventListener("click", function () { BYB.downloadIcsForEvent(ev); });

      BYB.wireClickTracking(container);
    })
    .catch(function () {
      notFound("We couldn't load this event right now.");
    });
})();
