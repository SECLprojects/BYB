// TEMPORARY — pre-launch notice shown on every page. To remove it once the
// site is ready to go live, delete this file (or just empty it) — nothing
// else needs to change, since every page just loads this one script and
// silently does nothing if it's missing/empty.
(function () {
  "use strict";

  var banner = document.createElement("div");
  banner.className = "dev-banner";
  banner.setAttribute("role", "status");
  banner.innerHTML =
    "<span>This website is still in development — some details may change before launch.</span>" +
    '<button type="button" class="dev-banner-close" aria-label="Dismiss this notice">&times;</button>';

  document.body.insertBefore(banner, document.body.firstChild);

  banner.querySelector(".dev-banner-close").addEventListener("click", function () {
    banner.remove();
  });
})();
