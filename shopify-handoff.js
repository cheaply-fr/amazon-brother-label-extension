(async function () {
  "use strict";

  const statusNode = document.getElementById("status");
  let brotherModulePromise;

  function status(message, error = false) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle("error", error);
  }

  function showPreview(base64Png) {
    document.getElementById("brother-label-preview")?.remove();
    const image = document.createElement("img");
    image.id = "brother-label-preview";
    image.alt = "Rendered Brother package label preview";
    image.src = `data:image/png;base64,${base64Png}`;
    image.style.cssText = "display:block;max-width:100%;max-height:70vh;margin:16px auto 0;border:1px solid #d8d8d8;background:#fff;object-fit:contain";
    statusNode?.insertAdjacentElement("afterend", image);
  }

  function waitForBrotherBridge(timeout = 8000) {
    if (document.body?.classList.contains("bpac-extension-installed")) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!document.body?.classList.contains("bpac-extension-installed")) return;
        clearTimeout(timer); observer.disconnect(); resolve();
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error("Brother b-PAC browser bridge is not ready. Verify that the Brother b-PAC extension is enabled, then reload this page."));
      }, timeout);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
    });
  }

  async function loadBrotherSdk() {
    brotherModulePromise ||= (async () => {
      await waitForBrotherBridge();
      return import(chrome.runtime.getURL("bpac-sdk.js"));
    })();
    return brotherModulePromise;
  }

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) throw new Error("Shopify order date is missing or invalid.");
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
  }

  function templateData(job, settings) {
    return {
      "Texte6": [job.destination, job.phone].filter(Boolean).join("\n"),
      "Texte10": String(job.channel || "").replace(/\r\n?/g, "\n"),
      "Code à barres1": settings.qrText || "",
      "Code à barres10": job.orderId || "",
      "Date et heure8": parseDate(job.date)
    };
  }

  async function printer(settings, printerName = settings.printerName) {
    const { default: BrotherSDK } = await loadBrotherSdk();
    return new BrotherSDK({ templatePath: settings.templatePath, printer: printerName, media: "62mm" });
  }

  async function resolvePrinter(settings) {
    const { default: BrotherSDK } = await loadBrotherSdk();
    const printers = await BrotherSDK.getPrinterList();
    const instances = new Map();
    const selected = await globalThis.CheaplyPrinterSelector.selectPrinter(printers, settings.printerName, async printerName => {
      const instance = await printer(settings, printerName);
      instances.set(printerName, instance);
      return instance.getPrinterStatus();
    });
    return { instance: instances.get(selected.printerName), printerStatus: selected.status };
  }

  try {
    const token = location.hash.slice(1);
    history.replaceState(null, "", location.pathname);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("This Shopify print handoff is invalid. Return to the order and prepare it again.");
    const response = await fetch("/v1/shopify/brother-print-jobs/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      credentials: "omit"
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok || !value.job) throw new Error(value.error || `The print handoff failed (${response.status}).`);
    const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    const { instance, printerStatus } = await resolvePrinter(settings);
    if (printerStatus.documentMedia !== "62mm") throw new Error(`Brother did not select the 62 mm continuous document format (selected: ${printerStatus.documentMedia || "unknown"}).`);
    const data = templateData(value.job, settings);
    if (value.job.mode === "check") {
      const image = await instance.getImageData(data);
      if (!image || image.length < 100) throw new Error("Brother could not render the package-label template.");
      showPreview(image);
      status(`Brother setup is ready (${printerStatus.printerName || settings.printerName}, 62 mm continuous). No label was printed.`);
    } else {
      await instance.print(data, { copies: 1, printName: `Shopify ${value.job.orderId}`, fitPage: false, autoCut: true, quality: true, highResolution: true, highSpeed: false });
      status(`One Shopify package label for ${value.job.orderId} was sent successfully.`);
    }
  } catch (error) {
    status(`Could not print: ${error?.message || error}`, true);
  }
})();
