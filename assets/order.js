(function () {
  "use strict";

  const API_BASE = (window.LINES_BY_LINES_CONFIG && window.LINES_BY_LINES_CONFIG.apiBase) || "";
  const POLL_MS = 2500;

  const form = document.getElementById("order-form");
  const panelForm = document.getElementById("order-panel-form");
  const panelProgress = document.getElementById("order-panel-progress");
  const panelError = document.getElementById("order-panel-error");
  const panelNames = document.getElementById("order-panel-names");
  const panelPay = document.getElementById("order-panel-pay");
  const reviewBlock = document.getElementById("order-review-block");
  const namesForm = document.getElementById("order-names-form");
  const namesFields = document.getElementById("order-names-fields");
  const namesSubmitBtn = document.getElementById("order-names-submit");
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
  const consentChatUpload = document.getElementById("consentChatUpload");
  const consentAgbWiderruf = document.getElementById("consentAgbWiderruf");
  const payConsentError = document.getElementById("order-pay-consent-error");

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
  let panelTransitioning = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showFlowStep(step) {
    if (panelForm) panelForm.hidden = step !== "form";
    if (panelProgress) panelProgress.hidden = step !== "progress";
    if (panelError) panelError.hidden = step !== "error";
    if (panelNames) panelNames.hidden = step !== "review";
    if (panelPay) panelPay.hidden = step !== "pay";
    if (reviewBlock) reviewBlock.hidden = step !== "review" && step !== "pay";
  }

  function personLabel(index) {
    const labels = ["Erste Person", "Zweite Person", "Dritte Person", "Vierte Person"];
    return labels[index] || `${index + 1}. Person`;
  }

  function renderParticipantFields(participants) {
    if (!namesFields) return;
    namesFields.innerHTML = "";

    (participants || []).forEach((participant) => {
      const original = String(participant.original || "").trim();
      const row = document.createElement("div");
      row.className = "order-form-row order-name-row";

      const label = document.createElement("label");
      label.className = "order-label order-name-label";
      label.setAttribute("for", `participant-name-${participant.index}`);
      label.textContent = original
        ? `${personLabel(participant.index)}: ${original}`
        : personLabel(participant.index);

      const detected = document.createElement("p");
      detected.className = "order-name-source";
      detected.textContent = "Erkannt in WhatsApp";

      const input = document.createElement("input");
      input.className = "order-input order-name-input";
      input.id = `participant-name-${participant.index}`;
      input.name = `participant_${participant.index}`;
      input.type = "text";
      input.maxLength = 48;
      input.autocomplete = "off";
      input.value = "";
      input.placeholder = original;
      input.dataset.original = original;
      input.setAttribute("aria-label", `Anzeigename für ${original}`);

      row.append(label, detected, input);
      namesFields.appendChild(row);
    });
  }

  function collectParticipantNames() {
    if (!namesFields) return [];
    return Array.from(namesFields.querySelectorAll("input.order-name-input")).map((input) => {
      const typed = String(input.value || "").trim();
      if (typed) return typed;
      return String(input.dataset.original || input.placeholder || "").trim();
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
  let previewBlob = null;

  function isIOS() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Data-URL fehlgeschlagen"));
      reader.readAsDataURL(blob);
    });
  }

  function waitForImageLoad(img) {
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      const onLoad = () => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
        reject(new Error("Vorschau konnte nicht geladen werden"));
      };
      img.addEventListener("load", onLoad);
      img.addEventListener("error", onError);
    });
  }

  function clearPosterPreview() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = "";
    }
    previewBlob = null;
    if (posterImage) posterImage.removeAttribute("src");
    if (posterPreview) posterPreview.hidden = true;
  }

  async function fetchPosterPreview(orderId) {
    if (!orderId) return false;

    const url = `${posterPreviewUrl(orderId)}?t=${Date.now()}`;
    const response = await fetch(url, { headers: apiHeaders() });
    if (!response.ok) return false;

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("image/")) return false;

    const blob = await response.blob();
    if (!blob || blob.size < 256) return false;
    if (blob.type && !blob.type.includes("image/")) return false;

    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewBlob = blob;
    previewObjectUrl = URL.createObjectURL(blob);
    return true;
  }

  async function mountPosterPreview() {
    if (!posterPreview || !posterImage || !previewBlob) return false;

    posterPreview.hidden = false;

    async function trySrc(src) {
      posterImage.removeAttribute("src");
      posterImage.src = src;
      await waitForImageLoad(posterImage);
    }

    try {
      if (isIOS()) {
        try {
          await trySrc(await blobToDataUrl(previewBlob));
          return true;
        } catch {
          // Fallback: Blob-URL nach sichtbarem Panel
        }
      }

      if (previewObjectUrl) {
        await trySrc(previewObjectUrl);
        return true;
      }
    } catch {
      clearPosterPreview();
    }

    return false;
  }

  async function loadAndMountPreview(orderId) {
    if (!orderId) return false;
    clearPosterPreview();
    const loaded = await loadPosterPreview(orderId);
    if (!loaded) return false;
    return mountPosterPreview();
  }

  async function loadPosterPreview(orderId) {
    if (!orderId) return false;

    try {
      return await fetchPosterPreview(orderId);
    } catch {
      clearPosterPreview();
      return false;
    }
  }

  function hidePendingBanner() {
    if (pendingBanner) pendingBanner.hidden = true;
  }

  function showPendingBanner() {
    if (pendingBanner) pendingBanner.hidden = false;
  }

  async function finishProgressThen(step, label) {
    setProgress(100, label || "Fertig!");
    await sleep(350);
    showFlowStep(step);
  }

  async function showReviewPanel(participants) {
    if (panelTransitioning) return;
    panelTransitioning = true;

    try {
      hidePendingBanner();
      renderParticipantFields(participants);

      const onProgress = panelProgress && !panelProgress.hidden;
      if (onProgress) {
        setProgress(94, "Vorschau wird geladen …");
      }

      if (currentOrderId) {
        await loadAndMountPreview(currentOrderId);
      }

      if (onProgress) {
        await finishProgressThen("review");
      } else {
        showFlowStep("review");
      }
    } finally {
      panelTransitioning = false;
    }
  }

  async function showPayPanel() {
    if (panelTransitioning) return;
    panelTransitioning = true;

    try {
      hidePendingBanner();

      const onProgress = panelProgress && !panelProgress.hidden;
      const previewReady =
        posterPreview &&
        !posterPreview.hidden &&
        posterImage &&
        posterImage.src &&
        posterImage.naturalWidth > 0;

      if (onProgress || (currentOrderId && !previewReady)) {
        if (onProgress) {
          setProgress(94, "Vorschau wird geladen …");
        }

        if (currentOrderId && !previewReady) {
          await loadAndMountPreview(currentOrderId);
        }

        if (onProgress) {
          await finishProgressThen("pay");
        } else {
          showFlowStep("pay");
          if (previewBlob && !previewReady) {
            await mountPosterPreview();
          }
        }
        return;
      }

      showFlowStep("pay");
    } finally {
      panelTransitioning = false;
    }
  }

  function resetToNewOrder() {
    stopPolling();
    currentOrderId = "";
    clearStoredOrder();
    clearPosterPreview();
    hidePendingBanner();
    form.reset();
    if (namesForm) namesForm.reset();
    if (namesFields) namesFields.innerHTML = "";
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "Jetzt bezahlen";
    }
    if (consentAgbWiderruf) consentAgbWiderruf.checked = false;
    if (payConsentError) payConsentError.hidden = true;
    showFlowStep("form");
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
      if (data.namesConfirmed === false) {
        await showReviewPanel(data.participants || []);
        return;
      }
      setProgress(92, "Fast fertig — Vorschau wird vorbereitet …");
      await showPayPanel();
      return;
    }

    if (data.status === "error") {
      stopPolling();
      if (errorText) {
        errorText.textContent =
          data.errorMessage || "Die ZIP konnte nicht verarbeitet werden.";
      }
      showFlowStep("error");
      return;
    }

    if (data.status === "checkout" || data.status === "paid" || data.status === "delivered") {
      stopPolling();
      if (data.namesConfirmed === false) {
        await showReviewPanel(data.participants || []);
        return;
      }
      await showPayPanel();
    }
  }

  function startPolling(orderId) {
    stopPolling();
    currentOrderId = orderId;
    storeOrderId(orderId);
    hidePendingBanner();
    showFlowStep("progress");
    setProgress(12, "Upload erfolgreich — Verarbeitung läuft …");
    pollStatus(orderId).catch((err) => {
      stopPolling();
      if (errorText) errorText.textContent = friendlyFetchError(err);
      showFlowStep("error");
    });
    pollTimer = setInterval(() => {
      pollStatus(orderId).catch((err) => {
        stopPolling();
        if (errorText) errorText.textContent = friendlyFetchError(err);
        showFlowStep("error");
      });
    }, POLL_MS);
  }

  function siteBaseUrl() {
    const path = window.location.pathname.replace(/\/[^/]*$/, "");
    if (!path || path === "/") return window.location.origin;
    return `${window.location.origin}${path}`;
  }

  async function startCheckout() {
    if (!currentOrderId) return;
    if (!consentAgbWiderruf?.checked) {
      if (payConsentError) payConsentError.hidden = false;
      consentAgbWiderruf?.focus();
      return;
    }
    if (payConsentError) payConsentError.hidden = true;
    payBtn.disabled = true;
    payBtn.textContent = "Weiterleitung …";

    try {
      const data = await apiFetch(
        `/api/orders/${encodeURIComponent(currentOrderId)}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteBase: siteBaseUrl(),
            consentAgbWiderruf: true,
          }),
        }
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
      showFlowStep("error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
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
      showFlowStep("error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Poster erstellen";
      }
    }
  });

  if (payBtn) payBtn.addEventListener("click", startCheckout);

  if (consentAgbWiderruf) {
    consentAgbWiderruf.addEventListener("change", () => {
      if (consentAgbWiderruf.checked && payConsentError) {
        payConsentError.hidden = true;
      }
    });
  }

  if (namesForm) {
    namesForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentOrderId) return;

      if (namesSubmitBtn) {
        namesSubmitBtn.disabled = true;
        namesSubmitBtn.textContent = "Wird übernommen …";
      }

      showFlowStep("progress");
      setProgress(18, "Poster wird mit euren Namen erstellt …");

      try {
        await apiFetch(
          `/api/orders/${encodeURIComponent(currentOrderId)}/participant-names`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: collectParticipantNames() }),
          }
        );

        clearPosterPreview();
        setProgress(88, "Finale Vorschau wird geladen …");
        await showPayPanel();
      } catch (err) {
        if (errorText) errorText.textContent = friendlyFetchError(err);
        showFlowStep("error");
      } finally {
        if (namesSubmitBtn) {
          namesSubmitBtn.disabled = false;
          namesSubmitBtn.textContent = "Namen übernehmen & weiter";
        }
      }
    });
  }

  if (posterImage) {
    posterImage.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  if (continuePayBtn) {
    continuePayBtn.addEventListener("click", () => {
      if (currentOrderId) showPayPanel().catch(() => {});
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
        if (data.namesConfirmed === false) {
          await showReviewPanel(data.participants || []);
          return;
        }
        if (allowPayPanel) {
          await showPayPanel();
        } else {
          showFlowStep("form");
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
        showFlowStep("error");
        return;
      }

      clearStoredOrder();
      showFlowStep("form");
    } catch {
      clearStoredOrder();
      showFlowStep("form");
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
