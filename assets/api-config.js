(function () {
  "use strict";

  var host = window.location.hostname;
  var port = window.location.port;
  var apiBase;

  if (port === "8787" || port === String(8787)) {
    apiBase = window.location.origin;
  } else if (host === "localhost" || host === "127.0.0.1") {
    apiBase = "http://127.0.0.1:8787";
  } else {
    apiBase = "https://91.99.92.9.nip.io";
  }

  window.LINES_BY_LINES_CONFIG = { apiBase: apiBase };
})();
