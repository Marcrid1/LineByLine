(function () {
  "use strict";

  const API_BASE = (window.LINES_BY_LINES_CONFIG && window.LINES_BY_LINES_CONFIG.apiBase) || "";
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
  const posterPreview = document.getElementById("order-poster-preview");
  const posterImage = document.getElementById("order-poster-image");
  const pendingBanner = document.getElementById("order-pending-banner");
  const continuePayBtn = document.getElementById("order-continue-pay-btn");
  const newOrderBtn = document.getElementById("order-new-order-btn");
  const newFromPayBtn = document.getElementById("order-new-from-pay-btn");
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
        "API-URL fehlt. Setze window.LINES_BY_LINES_CONFIG.apiBase in bestellen.html.";
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

  function clearStoredOrder() {
    try {
      sessionStorage.removeItem("linesByLinesOrderId");
    } catch {
      // ignore
    }
  }

  function storeOrderId(orderId) {
    try {
      sessionStorage.setItem("linesByLinesOrderId", orderId);
    } catch {
      // ignore
    }
  }

  function posterPreviewUrl(orderId) {
    return `${API_BASE.replace(/\/$/, "")}/api/orders/${encodeURIComponent(orderId)}/preview`;
  }

  let previewObjectUrl = "";

  function clearPosterPreview() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = "";
    }
    if (posterImage) posterImage.removeAttribute("src");
    if (posterPreview) posterPreview.hidden = true;
  }

  async function showPosterPreview(orderId) {
    if (!posterPreview || !posterImage || !orderId) return;

    const url = posterPreviewUrl(orderId);

    try {
      const response = await fetch(url, { headers: apiHeaders() });
      if (!response.ok) {
        clearPosterPreview();
        return;
      }
      const blob = await response.blob();
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = URL.createObjectURL(blob);
      posterImage.src = previewObjectUrl;
      posterPreview.hidden = false;
    } catch {
      clearPosterPreview();
    }
  }

  function hidePendingBanner() {
    if (pendingBanner) pendingBanner.hidden = true;
  }

  function showPendingBanner() {
    if (pendingBanner) pendingBanner.hidden = false;
  }

  function showPayPanel() {
    hidePendingBanner();
    showPanel(panelPay);
    if (currentOrderId) showPosterPreview(currentOrderId);
  }

  function resetToNewOrder() {
    stopPolling();
    currentOrderId = "";
    clearStoredOrder();
    clearPosterPreview();
    hidePendingBanner();
    form.reset();
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "Jetzt bezahlen";
    }
    showPanel(panelForm);
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
      const current = parseFloat(progressBar?.style.width) || 12;
      const next = Math.min(92, current + 1.5);
      setProgress(
        next,
        "Euer Chat wird analysiert und das Poster erstellt …"
      );
      return;
    }

    if (data.status === "ready") {
      stopPolling();
      setProgress(100, "Poster ist fertig!");
      setTimeout(() => showPayPanel(), 450);
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
      showPayPanel();
    }
  }

  function startPolling(orderId) {
    stopPolling();
    currentOrderId = orderId;
    storeOrderId(orderId);
    hidePendingBanner();
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

  if (posterImage) {
    posterImage.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  if (continuePayBtn) {
    continuePayBtn.addEventListener("click", () => {
      if (currentOrderId) showPayPanel();
    });
  }

  if (newOrderBtn) newOrderBtn.addEventListener("click", resetToNewOrder);
  if (newFromPayBtn) newFromPayBtn.addEventListener("click", resetToNewOrder);

  if (retryBtn) {
    retryBtn.addEventListener("click", resetToNewOrder);
  }

  async function resumeOrderById(orderId, options) {
    const allowPayPanel = Boolean(options && options.allowPayPanel);
    currentOrderId = orderId;

    try {
      const data = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/status`);

      if (data.status === "ready" || data.status === "checkout") {
        if (allowPayPanel) {
          showPayPanel();
        } else {
          showPanel(panelForm);
          showPendingBanner();
        }
        return;
      }

      if (data.status === "processing") {
        startPolling(orderId);
        return;
      }

      if (data.status === "error") {
        if (errorText) errorText.textContent = data.errorMessage || "Fehler";
        showPanel(panelError);
        return;
      }

      clearStoredOrder();
      showPanel(panelForm);
    } catch {
      clearStoredOrder();
      showPanel(panelForm);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const orderFromUrl = params.get("order");

  if (orderFromUrl) {
    resumeOrderById(orderFromUrl, { allowPayPanel: true });
  } else {
    try {
      const saved = sessionStorage.getItem("linesByLinesOrderId");
      if (saved) {
        resumeOrderById(saved, { allowPayPanel: false });
      }
    } catch {
      // ignore
    }
  }
})();
