(function () {
  "use strict";

  const BUTTON_ID = "cheaply-label-button";
  const BACKDROP_ID = "cheaply-label-backdrop";
  let brotherModulePromise;

  function waitForBrotherBridge(timeout = 8000) {
    if (document.body?.classList.contains("bpac-extension-installed")) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!document.body?.classList.contains("bpac-extension-installed")) return;
        clearTimeout(timer);
        observer.disconnect();
        resolve();
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error("Brother b-PAC browser bridge did not become ready. Reload the Amazon page and verify that the Brother b-PAC extension is enabled."));
      }, timeout);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true
      });
    });
  }

  function loadBrotherSdk() {
    brotherModulePromise ||= (async () => {
      await waitForBrotherBridge();
      return import(chrome.runtime.getURL("bpac-sdk.js"));
    })();
    return brotherModulePromise;
  }

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) throw new Error("Amazon order date is missing or invalid.");
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
  }

  function templateData(job) {
    return {
      "Texte6": [job.destination, job.phone ? `Tél. ${job.phone}` : ""].filter(Boolean).join("\n"),
      "Texte10": String(job.channel || "").replace(/\r\n?/g, "\n"),
      "Code à barres1": job.qrText || "",
      "Code à barres10": job.orderId || "",
      "Date et heure8": parseDate(job.date)
    };
  }

  function parseCurrentPage() {
    if (/^seller\.octopia\.com$/i.test(location.hostname)) {
      return globalThis.CheaplyOctopiaParser.parse(document.body.innerText);
    }
    return globalThis.CheaplyLabelParser.parse(document.body.innerText, undefined, location.href);
  }

  async function brotherPrinter(settings, printerName = settings.printerName) {
    const { default: BrotherSDK } = await loadBrotherSdk();
    return new BrotherSDK({
      templatePath: settings.templatePath,
      printer: printerName,
      media: "62mm"
    });
  }

  async function resolveBrotherPrinter(settings) {
    const { default: BrotherSDK } = await loadBrotherSdk();
    const printers = await BrotherSDK.getPrinterList();
    const instances = new Map();
    const selected = await globalThis.CheaplyPrinterSelector.selectPrinter(
      printers,
      settings.printerName,
      async (printerName) => {
        const printer = await brotherPrinter(settings, printerName);
        instances.set(printerName, printer);
        return printer.getPrinterStatus();
      }
    );
    return { printer: instances.get(selected.printerName), printerStatus: selected.status, printers };
  }

  async function checkBrotherSetup(job, settings) {
    const { printer, printerStatus, printers } = await resolveBrotherPrinter(settings);
    console.info("[Brother label] b-PAC status", JSON.stringify({ printers, printerStatus }));
    if (printerStatus.documentMedia !== "62mm") {
      throw new Error(`Brother did not select the 62 mm continuous document format (selected: ${printerStatus.documentMedia || "unknown"}).`);
    }
    const image = await printer.getImageData(templateData(job));
    if (!image || image.length < 100) throw new Error("Brother could not render the label template.");
    return printerStatus;
  }

  async function printOneLabel(job, settings) {
    const { printer } = await resolveBrotherPrinter(settings);
    return printer.print(templateData(job), {
      copies: 1,
      printName: job.orderId ? `${job.platform || "Marketplace"} ${job.orderId}` : "Marketplace package label",
      fitPage: false,
      autoCut: true,
      quality: true,
      highResolution: true,
      highSpeed: false
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "🏷️ Print package label";
    button.addEventListener("click", openDialog);
    document.body.appendChild(button);
  }

  function isOrderPage() {
    return globalThis.CheaplyLabelRoute.isOrderDetailsPage(location.href);
  }

  function syncButton() {
    if (isOrderPage()) {
      ensureButton();
      return;
    }
    document.getElementById(BUTTON_ID)?.remove();
    document.getElementById(BACKDROP_ID)?.remove();
  }

  async function openDialog() {
    document.getElementById(BACKDROP_ID)?.remove();
    const parsed = parseCurrentPage();
    const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    const fallbackChannel = String(settings.channel || "").split(/\r?\n/);
    const automaticAccount = parsed.accountLabel || fallbackChannel[0] || "";
    const automaticProduct = parsed.productLabel || fallbackChannel[1] || "";
    const addressLines = parsed.address.split("\n").filter(Boolean);
    const missingAddress = addressLines.length < 4 ||
      (addressLines.length <= 4 && !addressLines.slice(0, -2).some((line) => /\d/.test(line)));

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.innerHTML = `
      <form id="cheaply-label-dialog">
        <h2>Package label</h2>
        <p class="cl-subtitle">Review the ${escapeHtml(parsed.marketplace || parsed.platform || "marketplace")} data before printing one 62 mm Automatic Length label.</p>
        ${missingAddress ? '<p class="cl-warning">The marketplace appears to show only a partial delivery address for this order. Complete it before printing.</p>' : ""}
        <label for="cl-address">Destination</label>
        <textarea id="cl-address" required>${escapeHtml(parsed.address)}</textarea>
        <div class="cl-grid">
          <div>
            <label for="cl-phone">Telephone</label>
            <input id="cl-phone" value="${escapeHtml(parsed.phone)}" placeholder="Optional">
          </div>
          <div>
            <label for="cl-date">Order date</label>
            <input id="cl-date" value="${escapeHtml(parsed.date)}" required>
          </div>
        </div>
        <label for="cl-account-label">Sales account</label>
        <input id="cl-account-label" value="${escapeHtml(automaticAccount)}" title="${escapeHtml(parsed.accountName)}">
        <label for="cl-product-label">Object shortcut</label>
        <input id="cl-product-label" value="${escapeHtml(automaticProduct)}" title="${escapeHtml(parsed.productName)}">
        <label for="cl-order">Order ID</label>
        <input id="cl-order" value="${escapeHtml(parsed.orderId)}" maxlength="64" placeholder="Marketplace order number">
        <label for="cl-qr">QR sender details</label>
        <input id="cl-qr" value="${escapeHtml(settings.qrText || "")}" placeholder="Leave empty to omit the QR code">
        <div class="cl-actions">
          <button id="cheaply-label-cancel" type="button">Cancel</button>
          <button id="cheaply-label-check" type="button">Check printer setup</button>
          <button id="cheaply-label-print" type="submit">Print one label</button>
        </div>
        <p id="cheaply-label-status" class="cl-subtitle" role="status"></p>
      </form>`;

    document.body.appendChild(backdrop);
    const dialog = backdrop.querySelector("#cheaply-label-dialog");
    const address = backdrop.querySelector("#cl-address");
    address.focus();

    backdrop.querySelector("#cheaply-label-cancel").addEventListener("click", () => backdrop.remove());
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) backdrop.remove();
    });

    function collectJob() {
      return {
        destination: address.value.trim(),
        phone: backdrop.querySelector("#cl-phone").value.trim(),
        date: backdrop.querySelector("#cl-date").value.trim(),
        channel: [
          backdrop.querySelector("#cl-account-label").value.trim(),
          backdrop.querySelector("#cl-product-label").value.trim()
        ].filter(Boolean).join("\n"),
        qrText: backdrop.querySelector("#cl-qr").value.trim(),
        orderId: backdrop.querySelector("#cl-order").value.trim(),
        sellerOrderId: parsed.sellerOrderId,
        platform: parsed.platform || "Amazon"
      };
    }

    backdrop.querySelector("#cheaply-label-check").addEventListener("click", async (event) => {
      const checkButton = event.currentTarget;
      const status = backdrop.querySelector("#cheaply-label-status");
      checkButton.disabled = true;
      status.textContent = "Checking Brother setup…";
      try {
        const printerStatus = await checkBrotherSetup(collectJob(), settings);
        const media = printerStatus.documentMedia ? `, document: ${printerStatus.documentMedia} continuous` : "";
        status.textContent = `Brother setup is ready (${printerStatus.printerName || settings.printerName}${media}). No label was printed.`;
      } catch (error) {
        status.textContent = `Setup problem: ${error?.message || error}`;
      } finally {
        checkButton.disabled = false;
      }
    });

    dialog.addEventListener("submit", async (event) => {
      event.preventDefault();
      const destination = address.value.trim();
      if (!destination) return address.focus();

      const job = collectJob();
      const printButton = backdrop.querySelector("#cheaply-label-print");
      const status = backdrop.querySelector("#cheaply-label-status");
      printButton.disabled = true;
      printButton.textContent = "Printing…";
      status.textContent = "Sending one label to Brother QL-700…";
      try {
        await printOneLabel(job, settings);
        status.textContent = "One label was sent successfully.";
        setTimeout(() => backdrop.remove(), 1000);
      } catch (error) {
        printButton.disabled = false;
        printButton.textContent = "Print one label";
        status.textContent = `Could not print: ${error?.message || error}`;
      }
    });
  }

  syncButton();
  const observer = new MutationObserver(() => syncButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", syncButton);
  setInterval(syncButton, 1000);
})();
