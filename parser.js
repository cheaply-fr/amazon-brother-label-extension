(function (root) {
  "use strict";

  const START_HEADINGS = [
    "ship to",
    "expédier à",
    "adresse de livraison",
    "versenden an",
    "invia a",
    "enviar a",
    "verzenden naar"
  ];

  const END_HEADINGS = [
    "contact buyer",
    "contacter l'acheteur",
    "contactez l'acheteur",
    "order contents",
    "contenu de la commande",
    "package 1",
    "colis 1",
    "sales proceeds",
    "produit de la vente"
  ];

  function cleanLine(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/&#160;/gi, " ")
      .replace(/[\t ]+/g, " ")
      .trim();
  }

  function normalizedLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(cleanLine);
  }

  function isHeading(line, candidates) {
    const value = cleanLine(line).toLocaleLowerCase();
    return candidates.some((candidate) => value === candidate || value.startsWith(`${candidate}:`));
  }

  function extractOrderId(text, url) {
    const source = String(text || "").replace(/&#160;/gi, " ");
    const match = source.match(/(?:Order\s*(?:ID|number)|N(?:uméro|o) de(?: la)? commande)\s*(?:Facturation par Amazon)?\s*:?\s*#?\s*([0-9]{3}-[0-9]{7}-[0-9]{7})/i);
    if (match) return match[1];
    try {
      const parsedUrl = new URL(String(url || ""));
      for (const key of ["orderId", "orderID", "amazonOrderId", "amazon-order-id"]) {
        const queryMatch = String(parsedUrl.searchParams.get(key) || "").match(/\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/);
        if (queryMatch) return queryMatch[1];
      }
      const pathMatch = decodeURIComponent(parsedUrl.pathname).match(/\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/);
      if (pathMatch) return pathMatch[1];
    } catch {
      const urlMatch = String(url || "").match(/\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/);
      if (urlMatch) return urlMatch[1];
    }
    return "";
  }

  function extractSellerOrderId(text) {
    const match = String(text || "").match(/(?:Your Seller Order ID|Votre (?:numéro|ID) de commande vendeur)\s*:\s*#?\s*([^\s]+)/i);
    return match ? cleanLine(match[1]) : "";
  }

  const MONTHS = {
    january: 1, janvier: 1, jan: 1, janv: 1,
    february: 2, fevrier: 2, feb: 2, fevr: 2,
    march: 3, mars: 3, mar: 3,
    april: 4, avril: 4, apr: 4, avr: 4,
    may: 5, mai: 5,
    june: 6, juin: 6, jun: 6,
    july: 7, juillet: 7, jul: 7, juil: 7,
    august: 8, aout: 8, aug: 8,
    september: 9, septembre: 9, sep: 9, sept: 9,
    october: 10, octobre: 10, oct: 10,
    november: 11, novembre: 11, nov: 11,
    december: 12, decembre: 12, dec: 12
  };

  function formatDate(day, month, year) {
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  function dateFromOrderLine(value) {
    const line = cleanLine(value);
    let match = line.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
    if (match) return formatDate(match[1], match[2], match[3]);

    match = line.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (match) return formatDate(match[3], match[2], match[1]);

    match = line.match(/\b(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4})\b/);
    if (match) {
      const monthName = match[2].replace(/\./g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (MONTHS[monthName]) return formatDate(match[1], MONTHS[monthName], match[3]);
    }

    match = line.match(/\b([A-Za-zÀ-ÿ.]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (match) {
      const monthName = match[1].replace(/\./g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (MONTHS[monthName]) return formatDate(match[2], MONTHS[monthName], match[3]);
    }
    return "";
  }

  function extractOrderDate(text) {
    const source = String(text || "");
    const match = source.match(/(?:Date de (?:la )?commande|Date d['’]achat|Order date|Ordered on|Purchase date)\s*:?([\s\S]{0,160})/i);
    if (!match) return "";
    for (const line of match[1].split(/\r?\n/).slice(0, 5)) {
      const date = dateFromOrderLine(line);
      if (date) return date;
    }
    return "";
  }

  function extractAccountName(text) {
    const lines = normalizedLines(text).filter(Boolean);
    const orderHeading = lines.findIndex((line) => /order details|détails de la commande/i.test(line));
    const headerLines = lines.slice(0, orderHeading >= 0 ? orderHeading : 12);
    const marketplaces = new Set([
      "france", "united kingdom", "royaume-uni", "spain", "espagne", "españa",
      "italy", "italie", "italia", "germany", "allemagne", "deutschland",
      "netherlands", "pays-bas", "nederland", "belgium", "belgique", "belgië",
      "sweden", "suède", "sverige", "poland", "pologne", "polska", "ireland",
      "irlande", "éire"
    ]);
    const marketplaceIndex = headerLines.findIndex((line) => marketplaces.has(line.toLocaleLowerCase()));
    if (marketplaceIndex > 0) {
      const adjacentAccount = headerLines[marketplaceIndex - 1];
      if (adjacentAccount && !/^amazon$/i.test(adjacentAccount)) return adjacentAccount;
    }

    const ignored = new Set([
      "france", "united kingdom", "spain", "italy", "germany", "en", "fr", "help",
      "new seller central", "seller central", "menu", "products", "produits",
      "productos", "produkte", "prodotti", "workspace", "espace de travail",
      "arbeitsbereich", "area di lavoro", "mon entreprise", "my business"
    ]);
    return headerLines.find((line) => {
      const lower = line.toLocaleLowerCase();
      return /^[a-z0-9][a-z0-9._-]{2,}$/i.test(line) && !ignored.has(lower);
    }) || "";
  }

  function accountLabel(accountName) {
    return String(accountName || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/-([a-z]{2})$/i, ".$1");
  }

  function extractProductName(text) {
    const lines = normalizedLines(text);
    for (let index = 1; index < lines.length; index += 1) {
      if (/^ASIN\s*:/i.test(lines[index])) {
        for (let previous = index - 1; previous >= 0; previous -= 1) {
          if (lines[previous]) return lines[previous];
        }
      }
    }
    return "";
  }

  function productLabel(productName) {
    const normalized = String(productName || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    const tokens = normalized.match(/[A-Z0-9]+/g) || [];
    if (!tokens.length) return "";

    const brand = tokens[0].toLocaleLowerCase();
    const numericIndex = tokens.findIndex((token, index) => index > 0 && /\d/.test(token));
    let model = "";

    if (numericIndex > 0) {
      const numericToken = tokens[numericIndex];
      // If the numbered token is only a generation number ("Focus 2"),
      // the preceding word is the model. Otherwise the token itself is the model.
      model = /^[0-9]+$/.test(numericToken) ? tokens[numericIndex - 1] : numericToken;
    } else {
      model = tokens[1] || tokens[0];
    }

    return `${brand} ${model.slice(0, 4).toLocaleLowerCase()}`.trim();
  }

  function extractProductQuantity(text) {
    const lines = normalizedLines(text);
    const asinIndex = lines.findIndex((line) => /^ASIN\s*:/i.test(line));
    if (asinIndex < 0) return 1;

    // Amazon sometimes renders the quantity heading separately from the item
    // row. Prefer an explicitly labelled value, then fall back to the first
    // short standalone integer after the ASIN/SKU metadata and before prices.
    const end = Math.min(lines.length, asinIndex + 18);
    for (let index = asinIndex + 1; index < end; index += 1) {
      const labelled = lines[index].match(/^quantity\s*:?\s*(\d+)$/i);
      if (labelled) return Math.max(1, Number(labelled[1]));
      if (/^quantity\s*:?$/i.test(lines[index])) {
        const next = lines.slice(index + 1, Math.min(end, index + 4)).find(Boolean);
        if (/^\d{1,3}$/.test(next || "")) return Math.max(1, Number(next));
      }
    }

    for (let index = asinIndex + 1; index < end; index += 1) {
      const line = lines[index];
      const rowValue = line.match(/^(\d{1,3})(?=\s+\d+[.,]\d{2}\s*[€£$])/);
      if (rowValue) return Math.max(1, Number(rowValue[1]));
      if (/€|£|\$|included vat|item subtotal|unit price/i.test(line)) break;
      if (/^\d{1,3}$/.test(line)) return Math.max(1, Number(line));
    }
    return 1;
  }

  function productLabelWithQuantity(productName, quantity) {
    const label = productLabel(productName);
    return Number(quantity) > 1 ? `${label} x${quantity}` : label;
  }

  function looksLikePhone(line) {
    const digits = String(line || "").replace(/\D/g, "");
    return digits.length >= 8 && /(?:\+|\b0)[\d ()\-.]{7,}/.test(String(line || ""));
  }

  function extractPhone(text) {
    const inline = String(text || "").replace(/&#160;/gi, " ").match(/(?:téléphone|telephone|phone)\s*[:：]\s*([+()\d][\d ()\-.]{7,})/i);
    if (inline && looksLikePhone(inline[1])) return cleanLine(inline[1]);
    const lines = normalizedLines(text);
    for (let index = 0; index < lines.length; index += 1) {
      const labelled = lines[index].match(/^(?:téléphone|telephone|phone)\s*:\s*(.*)$/i);
      if (!labelled) continue;

      const inlineValue = cleanLine(labelled[1]);
      if (inlineValue && looksLikePhone(inlineValue)) return inlineValue;

      for (let next = index + 1; next < Math.min(lines.length, index + 3); next += 1) {
        if (looksLikePhone(lines[next])) return cleanLine(lines[next]);
      }
    }
    return "";
  }

  function extractShipTo(text) {
    const lines = normalizedLines(text);
    const start = lines.findIndex((line) => isHeading(line, START_HEADINGS));
    if (start < 0) return { addressLines: [], phone: "" };

    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (isHeading(lines[index], END_HEADINGS)) {
        end = index;
        break;
      }
    }

    const block = lines.slice(start + 1, end).filter(Boolean);
    const useful = block.filter((line) => {
      const lower = line.toLocaleLowerCase();
      return !/^[-—]+$/.test(line) &&
        lower !== "modifier" &&
        lower !== "edit" &&
        !lower.startsWith("instructions de livraison") &&
        !/^(?:client amazon business|invoice by amazon|facturation par amazon)$/i.test(line) &&
        !/(?:bon de commande|purchase order)\s*[:#]?/i.test(line);
    });

    let phone = "";
    const addressLines = [];
    useful.forEach((line) => {
      const labelled = line.match(/^(?:téléphone|telephone|phone)\s*:\s*(.+)$/i);
      if (!phone && labelled) {
        phone = cleanLine(labelled[1]);
      } else if (!phone && looksLikePhone(line)) {
        phone = line;
      } else {
        addressLines.push(line);
      }
    });

    return { addressLines, phone };
  }

  function dateInParis(now) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).formatToParts(now || new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.day}/${values.month}/${values.year}`;
  }

  function parse(text, now, url) {
    const shipTo = extractShipTo(text);
    const accountName = extractAccountName(text);
    const productName = extractProductName(text);
    const normalizedAccount = accountLabel(accountName);
    const quantity = extractProductQuantity(text);
    const normalizedProduct = productLabelWithQuantity(productName, quantity);
    return {
      orderId: extractOrderId(text, url),
      sellerOrderId: extractSellerOrderId(text),
      accountName,
      accountLabel: normalizedAccount,
      accountCode: normalizedAccount,
      productName,
      quantity,
      productLabel: normalizedProduct,
      productCode: normalizedProduct,
      address: shipTo.addressLines.join("\n"),
      phone: shipTo.phone || extractPhone(text),
      date: extractOrderDate(text)
    };
  }

  root.CheaplyLabelParser = {
    parse,
    extractOrderId,
    extractSellerOrderId,
    extractOrderDate,
    extractAccountName,
    accountLabel,
    extractProductName,
    extractProductQuantity,
    productLabel,
    productLabelWithQuantity,
    extractPhone,
    extractShipTo,
    dateInParis
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
