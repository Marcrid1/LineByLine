(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("order");
  var sessionId = params.get("session_id");
  var viewBtn = document.getElementById("view-poster-btn");
  var homeBtn = document.getElementById("home-btn");

  if (orderId) {
    document.getElementById("success-order-id").textContent =
      "Bestellnummer: " + orderId;
  }

  function apiBase() {
    var config = window.LINES_BY_LINES_CONFIG || {};
    return String(config.apiBase || "").replace(/\/$/, "");
  }

  function apiHeaders() {
    var headers = { "Content-Type": "application/json" };
    if (/ngrok/i.test(apiBase())) {
      headers["ngrok-skip-browser-warning"] = "1";
    }
    return headers;
  }

  function posterUrl() {
    return (
      apiBase() +
      "/api/orders/" +
      encodeURIComponent(orderId) +
      "/poster?session_id=" +
      encodeURIComponent(sessionId)
    );
  }

  if (!orderId || !sessionId || !apiBase()) {
    return;
  }

  if (viewBtn) {
    viewBtn.hidden = false;
    viewBtn.addEventListener("click", function (e) {
      e.preventDefault();
      viewBtn.disabled = true;
      viewBtn.textContent = "Wird geladen …";

      fetch(posterUrl(), { headers: apiHeaders() })
        .then(function (response) {
          if (!response.ok) throw new Error("PDF nicht verfügbar");
          return response.blob();
        })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank", "noopener");
          viewBtn.disabled = false;
          viewBtn.textContent = "Poster ansehen";
        })
        .catch(function () {
          viewBtn.disabled = false;
          viewBtn.textContent = "Poster ansehen";
          alert(
            "Poster konnte nicht geladen werden. Prüft euer E-Mail-Postfach – das PDF wurde dort hingeschickt."
          );
        });
    });
  }
  if (homeBtn) {
    homeBtn.classList.remove("btn-primary");
    homeBtn.classList.add("btn-secondary");
  }

  fetch(apiBase() + "/api/orders/" + encodeURIComponent(orderId) + "/fulfill", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ sessionId: sessionId }),
  }).catch(function () {});
})();
