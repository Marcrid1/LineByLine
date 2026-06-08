(function () {
  "use strict";

  function siteBasePath() {
    return window.location.pathname.indexOf("/LineByLine") === 0
      ? "/LineByLine"
      : "";
  }

  var FAVICON_VERSION = "2";

  function faviconHref(assetPath) {
    return siteBasePath() + assetPath + "?v=" + FAVICON_VERSION;
  }

  function installFavicons() {
    var head = document.head;
    if (!head) return;

    var specs = [
      { rel: "icon", href: faviconHref("/assets/favicon.png"), type: "image/png", sizes: "32x32" },
      {
        rel: "icon",
        href: faviconHref("/assets/favicon-192.png"),
        type: "image/png",
        sizes: "192x192",
      },
      {
        rel: "apple-touch-icon",
        href: faviconHref("/assets/apple-touch-icon.png"),
        type: "image/png",
        sizes: "180x180",
      },
      { rel: "shortcut icon", href: faviconHref("/favicon.ico"), type: "image/x-icon" },
    ];

    specs.forEach(function (spec) {
      var existing = head.querySelector('link[rel="' + spec.rel + '"][data-site-icon="1"]');
      if (existing) {
        existing.href = spec.href;
        if (spec.type) existing.type = spec.type;
        if (spec.sizes) existing.sizes = spec.sizes;
        return;
      }

      var link = document.createElement("link");
      link.rel = spec.rel;
      link.href = spec.href;
      link.setAttribute("data-site-icon", "1");
      if (spec.type) link.type = spec.type;
      if (spec.sizes) link.sizes = spec.sizes;
      head.insertBefore(link, head.firstChild);
    });
  }

  installFavicons();

  var STORAGE_KEY = "linesByLinesCookieConsent";
  var CONSENT_VERSION = 1;
  var FONTS_HREF =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap";

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== CONSENT_VERSION) return null;
      return data;
    } catch (_err) {
      return null;
    }
  }

  function loadGoogleFonts() {
    if (document.getElementById("lines-by-lines-fonts")) return;

    var href =
      (document.documentElement && document.documentElement.dataset.fontsHref) ||
      FONTS_HREF;

    if (!document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')) {
      var pre1 = document.createElement("link");
      pre1.rel = "preconnect";
      pre1.href = "https://fonts.googleapis.com";
      document.head.appendChild(pre1);
    }

    if (!document.querySelector('link[rel="preconnect"][href="https://fonts.gstatic.com"]')) {
      var pre2 = document.createElement("link");
      pre2.rel = "preconnect";
      pre2.href = "https://fonts.gstatic.com";
      pre2.crossOrigin = "anonymous";
      document.head.appendChild(pre2);
    }

    if (!document.querySelector('link[rel="preload"][data-lines-by-lines-fonts-preload="1"]')) {
      var preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "style";
      preload.href = href;
      preload.setAttribute("data-lines-by-lines-fonts-preload", "1");
      document.head.appendChild(preload);
    }

    var link = document.createElement("link");
    link.id = "lines-by-lines-fonts";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  window.LinesByLinesFonts = { load: loadGoogleFonts };

  var saved = readConsent();
  if (saved && saved.external) {
    loadGoogleFonts();
  }
})();
