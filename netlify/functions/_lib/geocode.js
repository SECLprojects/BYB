const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Free, no-API-key geocoding via OpenStreetMap's Nominatim service, used to
// place events on the map (map.html) without partners/staff ever having to
// enter coordinates themselves. Their usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) requires a
// descriptive User-Agent and caps automated use at roughly one request per
// second — comfortably met here, since this only runs once per approved
// event (a handful a month), never per page view.
//
// Returns { lat, lng } or null (address not found, or the request failed —
// either way, the event still applies without a map pin rather than
// blocking the whole approval on a geocoding hiccup).
async function geocodeAddress(query) {
  if (!query) return null;
  const url = NOMINATIM_URL + "?format=json&limit=1&countrycodes=au&q=" + encodeURIComponent(query);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BringYourBillsSite/1.0 (byb@secl.org.au)" }
    });
    if (!res.ok) {
      console.error("geocode: Nominatim returned " + res.status + " for query: " + query);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: lat, lng: lng };
  } catch (err) {
    console.error("geocode: request failed for query: " + query, err);
    return null;
  }
}

module.exports = { geocodeAddress };
