(function () {
  "use strict";

  var mapEl = document.getElementById("map");
  if (!mapEl) return;

  var BYB = window.BYB;
  var loadingNote = document.getElementById("map-loading");
  var unplacedSection = document.getElementById("map-unplaced-section");
  var unplacedList = document.getElementById("map-unplaced-list");

  // Roughly the geographic centre of Victoria — used only when there are
  // no located events yet, so the map isn't blank.
  var VIC_CENTER = [-37.0201, 144.9646];
  var VIC_DEFAULT_ZOOM = 7;

  function escapeHtml(str) {
    return BYB.escapeHtml(str);
  }

  function popupHtml(ev) {
    var mapsHref =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(ev.address || ((ev.venue || "") + " " + ev.title));

    return (
      '<div class="map-popup">' +
        '<div class="map-popup-date">' + escapeHtml(BYB.formatLongDate(BYB.parseEventDate(ev.date))) + "</div>" +
        '<div class="map-popup-title">' + escapeHtml(ev.title) + "</div>" +
        '<div class="map-popup-meta">' +
          escapeHtml(ev.time || "") +
          (ev.venue ? (ev.time ? " · " : "") + escapeHtml(ev.venue) : "") +
        "</div>" +
        (ev.address ? '<div class="map-popup-meta">' + escapeHtml(ev.address) + "</div>" : "") +
        '<div class="map-popup-chips">' + BYB.regionChipHtml(ev.region) + BYB.statusHtml(ev.status) + BYB.hostChipHtml(ev.host) + "</div>" +
        '<div class="map-popup-actions">' +
          '<a class="btn btn-secondary btn-sm" href="' + mapsHref + '" target="_blank" rel="noopener" data-track="map-get-directions">Get directions</a>' +
          '<a class="btn btn-rsvp btn-sm" href="register.html?event=' + encodeURIComponent(ev.id) + '" data-track="map-lets-know-coming">Let us know you\'re coming</a>' +
        "</div>" +
      "</div>"
    );
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  fetch("events.json")
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load events.json");
      return res.json();
    })
    .then(function (events) {
      loadingNote.hidden = true;

      var upcoming = BYB.upcomingNonGrey(events, BYB.startOfToday());
      var withCoords = upcoming.filter(function (ev) {
        return typeof ev.lat === "number" && typeof ev.lng === "number";
      });
      var withoutCoords = upcoming.filter(function (ev) {
        return !(typeof ev.lat === "number" && typeof ev.lng === "number");
      });

      var map = L.map(mapEl);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      var markersById = {};
      withCoords.forEach(function (ev) {
        var marker = L.marker([ev.lat, ev.lng]).addTo(map).bindPopup(popupHtml(ev));
        markersById[ev.id] = marker;
      });

      if (withCoords.length) {
        var bounds = L.latLngBounds(withCoords.map(function (ev) { return [ev.lat, ev.lng]; }));
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      } else {
        map.setView(VIC_CENTER, VIC_DEFAULT_ZOOM);
      }

      // Re-wire click tracking inside each popup as it opens — the popup's
      // content is only in the DOM once Leaflet renders it.
      map.on("popupopen", function (e) {
        var popupEl = e.popup.getElement();
        if (popupEl) BYB.wireClickTracking(popupEl);
      });

      var focusId = getQueryParam("event");
      if (focusId && markersById[focusId]) {
        map.setView(markersById[focusId].getLatLng(), 14);
        markersById[focusId].openPopup();
      }

      unplacedSection.hidden = withoutCoords.length === 0;
      unplacedList.innerHTML = withoutCoords
        .map(function (ev) {
          return (
            '<li class="request-card">' +
              '<div class="request-detail">' + escapeHtml(BYB.formatLongDate(BYB.parseEventDate(ev.date))) + " — " + escapeHtml(ev.title) + "</div>" +
              (ev.venue ? '<div class="request-detail">' + escapeHtml(ev.venue) + "</div>" : "") +
            "</li>"
          );
        })
        .join("");
    })
    .catch(function () {
      loadingNote.textContent = "We couldn't load the map right now. See the full calendar instead.";
    });
})();
