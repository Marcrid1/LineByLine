(function () {
  "use strict";

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

  function writeConsent(choices) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
        essential: true,
        external: !!choices.external,
      })
    );
  }

  function loadGoogleFonts() {
    if (window.LinesByLinesFonts && window.LinesByLinesFonts.load) {
      window.LinesByLinesFonts.load();
      return;
    }
    if (document.getElementById("lines-by-lines-fonts")) return;
    var href =
      (document.documentElement && document.documentElement.dataset.fontsHref) ||
      FONTS_HREF;
    var link = document.createElement("link");
    link.id = "lines-by-lines-fonts";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function applyConsent(consent) {
    hideBanner();
    hideSettings();
    if (consent && consent.external) {
      loadGoogleFonts();
    }
  }

  var bannerEl = null;
  var settingsEl = null;
  var externalToggle = null;

  function hideBanner() {
    if (bannerEl) bannerEl.hidden = true;
  }

  function hideSettings() {
    if (settingsEl) settingsEl.hidden = true;
  }

  function showBanner() {
    if (bannerEl) bannerEl.hidden = false;
  }

  function showSettings() {
    hideBanner();
    if (settingsEl) settingsEl.hidden = false;
    if (externalToggle) {
      var saved = readConsent();
      externalToggle.checked = !!(saved && saved.external);
    }
  }

  function acceptAll() {
    writeConsent({ external: true });
    applyConsent({ external: true });
  }

  function acceptEssentialOnly() {
    writeConsent({ external: false });
    applyConsent({ external: false });
  }

  function saveSettings() {
    var external = externalToggle ? externalToggle.checked : false;
    writeConsent({ external: external });
    applyConsent({ external: external });
  }

  function buildUi() {
    bannerEl = document.createElement("aside");
    bannerEl.className = "cookie-banner";
    bannerEl.setAttribute("role", "dialog");
    bannerEl.setAttribute("aria-labelledby", "cookie-banner-title");
    bannerEl.setAttribute("aria-describedby", "cookie-banner-text");
    bannerEl.innerHTML =
      '<div class="cookie-banner-inner">' +
      '<div class="cookie-banner-copy">' +
      "<h2 id=\"cookie-banner-title\">Cookies &amp; Datenschutz</h2>" +
      "<p id=\"cookie-banner-text\">Wir verwenden technisch notwendige Speicherung (z.&nbsp;B. für Ihre Cookie-Einstellungen und den Bestellablauf). " +
      "Optional laden wir Schriftarten von Google Fonts – dabei kann Ihre IP-Adresse an Google übermittelt werden. " +
      'Details in unserer <a href="./datenschutz.html">Datenschutzerklärung</a>.</p>' +
      "</div>" +
      '<div class="cookie-banner-actions">' +
      '<button type="button" class="btn btn-primary" data-cookie-accept-all>Alle akzeptieren</button>' +
      '<button type="button" class="btn btn-secondary" data-cookie-essential-only>Nur notwendige</button>' +
      '<button type="button" class="btn btn-ghost" data-cookie-open-settings>Einstellungen</button>' +
      "</div>" +
      "</div>";

    settingsEl = document.createElement("aside");
    settingsEl.className = "cookie-settings";
    settingsEl.hidden = true;
    settingsEl.setAttribute("role", "dialog");
    settingsEl.setAttribute("aria-labelledby", "cookie-settings-title");
    settingsEl.innerHTML =
      '<div class="cookie-settings-panel">' +
      '<button type="button" class="cookie-settings-close" data-cookie-close-settings aria-label="Schließen">&times;</button>' +
      "<h2 id=\"cookie-settings-title\">Cookie-Einstellungen</h2>" +
      "<p class=\"cookie-settings-intro\">Sie können Ihre Einwilligung jederzeit widerrufen oder anpassen.</p>" +
      '<div class="cookie-option">' +
      '<div class="cookie-option-head">' +
      "<strong>Notwendig</strong>" +
      '<span class="cookie-badge">Immer aktiv</span>' +
      "</div>" +
      "<p>Speichert Ihre Cookie-Auswahl und unterstützt den Bestellablauf (Session-Speicher).</p>" +
      "</div>" +
      '<div class="cookie-option">' +
      '<div class="cookie-option-head">' +
      "<strong>Externe Dienste (Google Fonts)</strong>" +
      '<label class="cookie-switch"><input type="checkbox" id="cookie-external-toggle" /><span class="cookie-switch-ui" aria-hidden="true"></span><span class="visually-hidden">Google Fonts erlauben</span></label>' +
      "</div>" +
      "<p>Lädt Schriftarten von Google. Dabei kann Ihre IP-Adresse an Google übermittelt werden.</p>" +
      "</div>" +
      '<div class="cookie-settings-actions">' +
      '<button type="button" class="btn btn-primary" data-cookie-save-settings>Auswahl speichern</button>' +
      '<button type="button" class="btn btn-secondary" data-cookie-essential-only>Nur notwendige</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(bannerEl);
    document.body.appendChild(settingsEl);
    externalToggle = document.getElementById("cookie-external-toggle");

    bannerEl.querySelector("[data-cookie-accept-all]").addEventListener("click", acceptAll);
    bannerEl
      .querySelector("[data-cookie-essential-only]")
      .addEventListener("click", acceptEssentialOnly);
    bannerEl
      .querySelector("[data-cookie-open-settings]")
      .addEventListener("click", showSettings);

    settingsEl.querySelector("[data-cookie-save-settings]").addEventListener("click", saveSettings);
    settingsEl
      .querySelectorAll("[data-cookie-essential-only]")
      .forEach(function (btn) {
        btn.addEventListener("click", acceptEssentialOnly);
      });
    settingsEl
      .querySelector("[data-cookie-close-settings]")
      .addEventListener("click", function () {
        hideSettings();
        if (!readConsent()) showBanner();
      });

    document.querySelectorAll("[data-cookie-settings]").forEach(function (el) {
      el.addEventListener("click", function (event) {
        event.preventDefault();
        showSettings();
      });
    });
  }

  window.LinesByLinesCookieConsent = {
    openSettings: showSettings,
    getConsent: readConsent,
  };

  function init() {
    buildUi();
    var saved = readConsent();
    if (saved) {
      applyConsent(saved);
    } else {
      showBanner();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
