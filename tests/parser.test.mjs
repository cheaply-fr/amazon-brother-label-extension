import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const context = { globalThis: {}, Intl, Date };
vm.runInNewContext(await readFile(new URL("../parser.js", import.meta.url), "utf8"), context);
const parser = context.globalThis.CheaplyLabelParser;
const contentSource = await readFile(new URL("../content.js", import.meta.url), "utf8");

test("parses order number, purchase date, address, phone, model and quantity", () => {
  const result = parser.parse(`
CHRecycle
Order details
Order ID: # 305-3488148-3093158
Purchase date:
Wed, 26 Aug 2026, 18:09 MEST
Ship to
Emanuel Bennici
Fröbelweg 4
Neu-ulm
89233
Germany
Phone: +4915162560139
Order contents
SK Hynix 32 GB DDR4-2400
ASIN: B0762WP67R
Quantity: 4
`);
  assert.equal(result.orderId, "305-3488148-3093158");
  assert.equal(result.date, "26/08/2026");
  assert.equal(result.phone, "+4915162560139");
  assert.equal(result.quantity, 4);
  assert.match(result.productLabel, /x4$/);
  assert.match(result.address, /Fröbelweg 4/);
});

test("uses four model characters and omits x1", () => {
  assert.equal(parser.productLabelWithQuantity("Lenovo 40AF0135EU dock", 1), "lenovo 40af");
});

test("uses the account beside the marketplace instead of the navigation menu", () => {
  const result = parser.parse(`
Menu
Products
Workspace
Amazon
CHRecycle
Spain
Account health
Order details
Order ID: # 402-4074345-2436318
Purchase date: Fri, 28 Aug 2026, 17:41 MEST
Ship to
Buyer Name
1 Example Street
75001 Paris
France
Order contents
Dell WD19DCS dock
ASIN: B08XNHD4TQ
Quantity: 1
`);
  assert.equal(result.accountName, "CHRecycle");
  assert.equal(result.accountLabel, "chrecycle");
});

test("uses the account beside a localized marketplace in the refreshed navigation", () => {
  const result = parser.parse(`
Menu
Mon entreprise
Produits
Espace de travail
Amazon
CHRecycle
Espagne
État du compte
Détails de la commande
Numéro de la commande : # 402-8112978-0376315
Date d'achat: jeu. 3 sept. 2026, 17:20 MEST
`);
  assert.equal(result.accountName, "CHRecycle");
  assert.equal(result.accountLabel, "chrecycle");
});

test("supports Amazon's refreshed order layout and ignores invoice metadata", () => {
  const result = parser.parse(`
CHRecycle
France
Détails de la commande  Numéro de la commande&#160;: # 402-1704332-3287560 Client Amazon Business Invoice by Amazon Votre ID de commande vendeur: # 5398
Résumé de la commande
Numéro de la commande Facturation par Amazon: # 408-1020633-9626735
Date d'achat: mar. 1 sept. 2026, 15:49 MEST
Adresse de livraison
Amazon Business EU SARLBon de commandeC105243
OMEGA INGENIERIE - Caroline QUESNEL
1, Rue Ettore Bugatti
68127 Sainte-Croix-en-Plaine,
France
Contacter l'acheteur:\tAmazon Business EU SARL
Téléphone:\t0601014752\t
Contenu de la commande
Lenovo 40AS0090EU Station d'accueil
ASIN: B07RWPJLQ1
Quantité
1
`, undefined, "https://sellercentral.amazon.fr/orders-v3/order/402-1704332-3287560");
  assert.equal(result.orderId, "402-1704332-3287560");
  assert.equal(result.sellerOrderId, "5398");
  assert.equal(result.date, "01/09/2026");
  assert.equal(result.phone, "0601014752");
  assert.doesNotMatch(result.address, /Bon de commande|Amazon Business EU SARL/);
  assert.match(result.address, /OMEGA INGENIERIE/);
});

test("falls back to the order URL when Amazon renders the order number separately", () => {
  const result = parser.parse("Détails de la commande\nNuméro de la commande\n402-1704332-3287560", undefined, "https://sellercentral-europe.amazon.com/orders-v3/order/402-1704332-3287560");
  assert.equal(result.orderId, "402-1704332-3287560");
});

test("supports Amazon's new order path and query URL formats", () => {
  assert.equal(parser.extractOrderId("", "https://sellercentral.amazon.fr/amazonsell/orders/402-1704332-3287560"), "402-1704332-3287560");
  assert.equal(parser.extractOrderId("", "https://sellercentral-europe.amazon.com/amazonsell/order-details?orderId=403-4090293-1103563"), "403-4090293-1103563");
});

test("manual order number corrections are editable and used for printing", () => {
  assert.doesNotMatch(contentSource, /id="cl-order"[^>]*\sreadonly/);
  assert.match(contentSource, /orderId:\s*backdrop\.querySelector\("#cl-order"\)\.value\.trim\(\)/);
});
