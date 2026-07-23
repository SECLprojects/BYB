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
          '<a class="btn btn-rsvp btn-sm" href="register.html?event=' + encodeURIComponent(ev.id) + '" data-track="map-lets-know-coming">' + BYB.iconLabel("rsvp", "Let us know you're coming") + "</a>" +
          '<a class="btn btn-secondary btn-sm" href="' + mapsHref + '" target="_blank" rel="noopener" data-track="map-get-directions">' + BYB.iconLabel("directions", "Get directions") + "</a>" +
          '<a class="btn btn-secondary btn-sm" href="event.html?id=' + encodeURIComponent(ev.id) + '" data-track="map-view-event">' + BYB.iconLabel("info", "View event details") + "</a>" +
        "</div>" +
      "</div>"
    );
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  var filterPanel = document.getElementById("region-filter-panel");
  var statusEl = document.getElementById("map-status");
  var totalRegionCount = Object.keys(BYB.REGION_META).length;

  fetch("events.json")
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load events.json");
      return res.json();
    })
    .then(function (events) {
      loadingNote.hidden = true;

      var allUpcoming = BYB.upcomingNonGrey(events, BYB.startOfToday());

      var map = L.map(mapEl);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      var markersLayer = L.layerGroup().addTo(map);
      var firstRender = true;
      var focusId = getQueryParam("event");

      // Re-wire click tracking inside each popup as it opens — the popup's
      // content is only in the DOM once Leaflet renders it.
      map.on("popupopen", function (e) {
        var popupEl = e.popup.getElement();
        if (popupEl) BYB.wireClickTracking(popupEl);
      });

      function render(selectedRegions) {
        var selectedSet = null;
        if (selectedRegions) {
          selectedSet = {};
          selectedRegions.forEach(function (r) { selectedSet[r] = true; });
        }
        var upcoming = selectedSet
          ? allUpcoming.filter(function (ev) { return selectedSet[ev.region]; })
          : allUpcoming;

        var withCoords = upcoming.filter(function (ev) {
          return typeof ev.lat === "number" && typeof ev.lng === "number";
        });
        var withoutCoords = upcoming.filter(function (ev) {
          return !(typeof ev.lat === "number" && typeof ev.lng === "number");
        });

        markersLayer.clearLayers();
        var markersById = {};
        withCoords.forEach(function (ev) {
          var marker = L.marker([ev.lat, ev.lng]).addTo(markersLayer).bindPopup(popupHtml(ev));
          markersById[ev.id] = marker;
        });

        if (withCoords.length) {
          var bounds = L.latLngBounds(withCoords.map(function (ev) { return [ev.lat, ev.lng]; }));
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
        } else {
          map.setView(VIC_CENTER, VIC_DEFAULT_ZOOM);
        }

        if (firstRender && focusId && markersById[focusId]) {
          map.setView(markersById[focusId].getLatLng(), 14);
          markersById[focusId].openPopup();
        }
        firstRender = false;

        if (statusEl) {
          var filterActive = selectedRegions && selectedRegions.length < totalRegionCount;
          var n = withCoords.length;
          statusEl.textContent =
            (n === 0
              ? "No events are shown on the map"
              : "Showing " + n + " event" + (n === 1 ? "" : "s") + " on the map") +
            (filterActive ? " for the regions you've selected." : ".") +
            (withoutCoords.length ? " " + withoutCoords.length + " more listed below without a map location." : "");
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
      }

      if (filterPanel) {
        filterPanel.innerHTML = BYB.buildRegionFilterHtml();
        BYB.wireRegionFilter(filterPanel, render);
      }

      render(null);
    })
    .catch(function () {
      loadingNote.textContent = "We couldn't load the map right now. See the full calendar instead.";
    });
})();
