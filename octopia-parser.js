(function exposeOctopiaParser(scope) {
  "use strict";

  function cleanLine(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/[\t ]+/g, " ").trim();
  }

  function linesFrom(text) {
    return String(text || "").split(/\r?\n/).map(cleanLine);
  }

  function nextValue(lines, labelPattern, start = 0, end = lines.length) {
    const index = lines.findIndex((line, position) => position >= start && position < end && labelPattern.test(line));
    if (index < 0) return "";
    return lines.slice(index + 1, Math.min(end, index + 5)).find(Boolean) || "";
  }

  function looksLikePhoneValue(value) {
    const text = cleanLine(value);
    const digits = text.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && /^\+?[\d ().-]+$/.test(text);
  }

  function extractOrderId(text) {
    const match = String(text || "").match(/N(?:°|o)\s*de commande\s*:?\s*([A-Z0-9-]{6,64})/i);
    return match ? cleanLine(match[1]) : "";
  }

  function extractOrderDate(text) {
    const lines = linesFrom(text);
    const value = nextValue(lines, /^Date de la commande$/i);
    const match = value.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/);
    return match ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}` : "";
  }

  function extractAccountName(text) {
    const lines = linesFrom(text);
    return nextValue(lines, /^Bienvenue dans votre espace vendeur$/i) || nextValue(lines, /^Canal de vente$/i);
  }

  function extractCustomer(text) {
    const lines = linesFrom(text);
    const customerStart = lines.findIndex((line) => /^Informations client$/i.test(line));
    if (customerStart < 0) return { address: "", phone: "" };
    const deliveryStart = lines.findIndex((line, index) => index > customerStart && /^Adresse de livraison$/i.test(line));
    if (deliveryStart < 0) return { address: "", phone: "" };
    const billingStart = lines.findIndex((line, index) => index > deliveryStart && /^Adresse de facturation$/i.test(line));
    const end = billingStart > deliveryStart ? billingStart : lines.length;

    const name = nextValue(lines, /^Nom, Prénom$/i, deliveryStart, end);
    const street = nextValue(lines, /^Adresse$/i, deliveryStart, end);
    const postalCode = nextValue(lines, /^Code postal$/i, deliveryStart, end);
    const city = nextValue(lines, /^Ville$/i, deliveryStart, end);
    const country = nextValue(lines, /^Pays$/i, deliveryStart, end);
    const labelledPhone = nextValue(lines, /^N(?:°|o) de (?:tél\.?|tel\.?) portable$/i, deliveryStart, end);
    const phone = looksLikePhoneValue(labelledPhone)
      ? labelledPhone
      : lines.slice(deliveryStart + 1, end).find(looksLikePhoneValue) || "";
    return {
      address: [name, street, [postalCode, city].filter(Boolean).join(" "), country].filter(Boolean).join("\n"),
      phone
    };
  }

  function extractProduct(text) {
    const lines = linesFrom(text);
    const productStart = lines.findIndex((line) => /^Produits commandés$/i.test(line));
    const productEnd = lines.findIndex((line, index) => index > productStart && /^Historique de la commande$/i.test(line));
    const end = productEnd > productStart ? productEnd : lines.length;
    const referenceIndex = lines.findIndex((line, index) => index > productStart && index < end && /^Votre référence\s*:/i.test(line));
    const skuIndex = lines.findIndex((line, index) => index > productStart && index < end && /^SKU\s*:/i.test(line));
    const eanIndex = lines.findIndex((line, index) => index > productStart && index < end && /^EAN\s*:/i.test(line));
    const anchorIndex = referenceIndex >= 0 ? referenceIndex : skuIndex;
    const ignored = /^(Statut|Image|Produit|Condition|Quantité|Prix total|Actions|Acceptée)$/i;
    const productName = anchorIndex > productStart
      ? [...lines.slice(productStart + 1, anchorIndex)].reverse().find((line) => line && !ignored.test(line)) || ""
      : "";
    const referenceMatch = (referenceIndex >= 0 ? lines[referenceIndex] : "").match(/^Votre référence\s*:\s*(.+)$/i);
    const skuMatch = (skuIndex >= 0 ? lines[skuIndex] : "").match(/^SKU\s*:\s*(.+)$/i);
    const modelSource = cleanLine(productName || referenceMatch?.[1] || skuMatch?.[1]);

    let quantity = 1;
    for (let index = Math.max(productStart, referenceIndex, skuIndex, eanIndex) + 1; index < end; index += 1) {
      if (/^\d{1,3}$/.test(lines[index])) {
        quantity = Math.max(1, Number(lines[index]));
        break;
      }
    }
    return { productName, modelSource, quantity };
  }

  function parse(text) {
    const customer = extractCustomer(text);
    const product = extractProduct(text);
    const accountName = extractAccountName(text);
    const accountLabel = scope.CheaplyLabelParser.accountLabel(accountName);
    const productLabel = scope.CheaplyLabelParser.productLabelWithQuantity(product.modelSource, product.quantity);
    return {
      platform: "Octopia",
      marketplace: "Cdiscount",
      orderId: extractOrderId(text),
      sellerOrderId: "",
      accountName,
      accountLabel,
      accountCode: accountLabel,
      productName: product.productName,
      quantity: product.quantity,
      productLabel,
      productCode: productLabel,
      address: customer.address,
      phone: customer.phone,
      date: extractOrderDate(text)
    };
  }

  scope.CheaplyOctopiaParser = Object.freeze({ parse, extractOrderId, extractOrderDate, extractAccountName, extractCustomer, extractProduct, looksLikePhoneValue });
})(globalThis);
