(function () {
  "use strict";

  const API_BASE = (window.LINE_BY_LINE_CONFIG && window.LINE_BY_LINE_CONFIG.apiBase) || "";
  const POLL_MS = 2500;

  const form = document.getElementById("order-form");
  const panelForm = document.getElementById("order-panel-form");
  const panelProgress = document.getElementById("order-panel-progress");
  const panelError = document.getElementById("order-panel-error");
  const panelPay = document.getElementById("order-panel-pay");
  const progressBar = document.getElementById("order-progress-bar");
  const progressLabel = document.getElementById("order-progress-label");
  const errorText = document.getElementById("order-error-text");
  const payBtn = document.getElementById("order-pay-btn");
  const retryBtn = document.getElementById("order-retry-btn");
  const apiWarning = document.getElementById("order-api-warning");

  function apiHeaders() {
    const headers = {};
    if (/ngrok/i.test(API_BASE)) {
      headers["ngrok-skip-browser-warning"] = "1";
    }
    return headers;
  }

  if (!form || !API_BASE) {
    if (apiWarning) {
      apiWarning.hidden = false;
      apiWarning.textContent =
        "API-URL fehlt. Setze window.LINE_BY_LINE_CONFIG.apiBase in bestellen.html.";
    }
    return;
  }

  let currentOrderId = "";
  let pollTimer = null;

  function showPanel(panel) {
    [panelForm, panelProgress, panelError, panelPay].forEach((el) => {
      if (el) el.hidden = el !== panel;
    });
  }

  function setProgress(percent, label) {
    if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (progressLabel) progressLabel.textContent = label;
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function friendlyFetchError(err) {
    const msg = String(err?.message || err || "");
    if (/failed to fetch/i.test(msg)) {
      return (
        "Verbindung zur API fehlgeschlagen. Lokal testen: http://127.0.0.1:8787/bestellen.html öffnen " +
        "(nicht Live Server / ngrok)."
      );
    }
    return msg || "Unbekannter Fehler";
  }

  async function apiFetch(path, options) {
    const response = await fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: {
        ...apiHeaders(),
        ...(options?.headers || {}),
      },
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.error || `Anfrage fehlgeschlagen (${response.status})`);
    }
    return data;
  }

  async function pollStatus(orderId) {
    const data = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/status`);

    if (data.status === "processing") {
      setProgress(55, "Euer Chat wird analysiert und das Poster erstellt …");
      return;
    }

    if (data.status === "ready") {
      stopPolling();
      setProgress(100, "Poster ist fertig!");
      showPanel(panelPay);
      return;
    }

    if (data.status === "error") {
      stopPolling();
      if (errorText) {
        errorText.textContent =
          data.errorMessage || "Die ZIP konnte nicht verarbeitet werden.";
      }
      showPanel(panelError);
      return;
    }

    if (data.status === "checkout" || data.status === "paid" || data.status === "delivered") {
      stopPolling();
      showPanel(panelPay);
    }
  }

  function startPolling(orderId) {
    currentOrderId = orderId;
    try {
      sessionStorage.setItem("lineByLineOrderId", orderId);
    } catch {
      // ignore
    }
    showPanel(panelProgress);
    setProgress(12, "Upload erfolgreich — Verarbeitung läuft …");
    pollStatus(orderId).catch((err) => {
      stopPolling();
      if (errorText) errorText.textContent = friendlyFetchError(err);
      showPanel(panelError);
    });
    pollTimer = setInterval(() => {
      pollStatus(orderId).catch((err) => {
        stopPolling();
        if (errorText) errorText.textContent = friendlyFetchError(err);
        showPanel(panelError);
      });
    }, POLL_MS);
  }

  async function startCheckout() {
    if (!currentOrderId) return;
    payBtn.disabled = true;
    payBtn.textContent = "Weiterleitung …";

    try {
      const data = await apiFetch(
        `/api/orders/${encodeURIComponent(currentOrderId)}/checkout`,
        { method: "POST" }
      );
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Keine Stripe-URL erhalten.");
    } catch (err) {
      payBtn.disabled = false;
      payBtn.textContent = "Jetzt bezahlen";
      if (errorText) errorText.textContent = friendlyFetchError(err);
      showPanel(panelError);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Wird hochgeladen …";
    }

    const formData = new FormData(form);

    try {
      const response = await fetch(`${API_BASE.replace(/\/$/, "")}/api/orders`, {
        method: "POST",
        headers: apiHeaders(),
        body: formData,
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (!response.ok) {
        throw new Error(data.error || "Upload fehlgeschlagen");
      }
      startPolling(data.orderId);
    } catch (err) {
      if (errorText) errorText.textContent = friendlyFetchError(err);
      showPanel(panelError);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Poster erstellen";
      }
    }
  });

  if (payBtn) payBtn.addEventListener("click", startCheckout);

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      stopPolling();
      currentOrderId = "";
      try {
        sessionStorage.removeItem("lineByLineOrderId");
      } catch {
        // ignore
      }
      form.reset();
      showPanel(panelForm);
    });
  }

  async function resumeOrderById(orderId) {
    currentOrderId = orderId;
    try {
      const data = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/status`);
      if (data.status === "ready" || data.status === "checkout") {
        showPanel(panelPay);
      } else if (data.status === "processing") {
        startPolling(orderId);
      } else if (data.status === "error") {
        if (errorText) errorText.textContent = data.errorMessage || "Fehler";
        showPanel(panelError);
      }
    } catch {
      showPanel(panelForm);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const orderFromUrl = params.get("order");

  if (orderFromUrl) {
    resumeOrderById(orderFromUrl);
  } else {
    try {
      const saved = sessionStorage.getItem("lineByLineOrderId");
      if (saved) resumeOrderById(saved);
    } catch {
      // ignore
    }
  }
})();
