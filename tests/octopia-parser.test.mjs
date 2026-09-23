import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const context = { globalThis: {}, Intl, Date };
vm.runInNewContext(await readFile(new URL("../parser.js", import.meta.url), "utf8"), context);
vm.runInNewContext(await readFile(new URL("../octopia-parser.js", import.meta.url), "utf8"), context);
const parser = context.globalThis.CheaplyOctopiaParser;

const orderText = `
Bienvenue dans votre espace vendeur
cheaply
N° de commande 2609121943KHAYG
Date de la commande
12/09/2026
Canal de vente
Cdiscount
Produits commandés
Statut Image Produit Condition Quantité Prix total + expédition (EUR) Actions
Acceptée
Jabra Evolve2 65 Flex MS Stereo
Votre référence : jab1685406238532
SKU : JAB1685406238532
EAN : 5706991029154
Neuf
6
229,00
Historique de la commande
Informations client
Adresse de livraison
Nom, Prénom
Mme EXEMPLE Alice
Adresse
2 rue de Test
Code postal
34370
Ville
EXEMPLEVILLE
Pays
FR
N° de tel. portable
0612345678
Copier dans le presse-papiers
Adresse de facturation
`;

test("parses an Octopia/Cdiscount order into the Brother label fields", () => {
  const result = parser.parse(orderText);
  assert.equal(result.platform, "Octopia");
  assert.equal(result.marketplace, "Cdiscount");
  assert.equal(result.orderId, "2609121943KHAYG");
  assert.equal(result.date, "12/09/2026");
  assert.equal(result.accountLabel, "cheaply");
  assert.equal(result.phone, "0612345678");
  assert.equal(result.quantity, 6);
  assert.equal(result.productLabel, "jabra evol x6");
  assert.match(result.address, /Mme EXEMPLE Alice\n2 rue de Test\n34370 EXEMPLEVILLE\nFR/);
});

test("does not leak billing details into the delivery address", () => {
  const result = parser.parse(`${orderText}\nNom, Prénom\nBilling Person\nAdresse\n99 Billing Road`);
  assert.doesNotMatch(result.address, /Billing/);
});

test("falls back to a plausible phone value when Octopia changes or omits the label", () => {
  const changedLabel = orderText.replace("N° de tel. portable", "Téléphone mobile du destinataire");
  const result = parser.parse(changedLabel);
  assert.equal(result.phone, "0612345678");
  assert.equal(parser.looksLikePhoneValue("34370"), false);
  assert.equal(parser.looksLikePhoneValue("+33 6 12 34 56 78"), true);
});
