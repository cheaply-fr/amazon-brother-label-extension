import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const context = { globalThis: {}, Intl, Date };
for (const file of ["parser.js", "octopia-parser.js", "label-data.js"]) {
  vm.runInNewContext(await readFile(new URL(`../${file}`, import.meta.url), "utf8"), context);
}
const amazon = context.globalThis.CheaplyLabelParser;
const octopia = context.globalThis.CheaplyOctopiaParser;
const labelData = context.globalThis.CheaplyLabelData;

function ptouchData(job, qrText = "sender") {
  return {
    "Texte6": labelData.destinationWithPhone(job.address, job.phone),
    "Texte10": job.accountLabel,
    "Code à barres1": qrText,
    "Code à barres10": job.orderId,
    "Date et heure8": job.date
  };
}

test("Amazon order flows from refreshed page text to complete P-touch data", () => {
  const job = amazon.parse(`
CHRecycle France
Détails de la commande  Numéro de la commande&#160;: # 402-1704332-3287560
Date d'achat: mar. 1 sept. 2026, 15:49 MEST
Adresse de livraison
OMEGA INGENIERIE - Caroline QUESNEL
1, Rue Ettore Bugatti
68127 Sainte-Croix-en-Plaine,
France
Téléphone:\t0601014752
Contenu de la commande
Lenovo 40AS0090EU Station d'accueil
Quantité
1
`, undefined, "https://sellercentral.amazon.fr/orders-v3/order/402-1704332-3287560");
  const data = ptouchData(job);
  assert.equal(data["Code à barres10"], "402-1704332-3287560");
  assert.match(data.Texte6, /0601014752/);
  assert.equal(data["Date et heure8"], "01/09/2026");
});

test("the exact Cdiscount order flows to a phone-bearing label payload", () => {
  const job = octopia.parse(`
Bienvenue dans votre espace vendeur cheaply
N° de commande 2609290904LIVD6
Date de la commande
29/09/2026
Canal de vente
Cdiscount
Produits commandés
Jabra Evolve2 65 Flex MS Stereo - Micro-casque - s
Votre référence : 5706991029093
SKU : JAB5706991029093
EAN : 5706991029093
Neuf
1
Historique de la commande
Informations client
Adresse de livraison
Nom, Prénom
M. TADLAOUI CHAGDALI Zakaria
Entreprise
SMARTCOMPTA95
Adresse
14 Avenue De L Europe
Code postal
95400
Ville
Villiers Le Bel
Pays
FR
N° de tel. portable
0621320737
Copier dans le presse-papiers
Adresse de facturation
`);
  const data = ptouchData(job);
  assert.equal(data["Code à barres10"], "2609290904LIVD6");
  assert.match(data.Texte6, /FR · Tél\. 0621320737$/);
  assert.equal(data["Date et heure8"], "29/09/2026");
});

test("pipeline retains phone and order ID when the phone is international", () => {
  const job = octopia.parse(`
N° de commande X2609290904LIVD6
Date de la commande
29.09.2026
Informations client
Adresse de livraison
Nom, Prénom
Recipient
Adresse
1 Example Street
Code postal
75001
Ville
Paris
Pays
FR
N° de tel. portable
+33 (0)6 21 32 07 37
Adresse de facturation
`);
  const data = ptouchData(job);
  assert.equal(data["Code à barres10"], "X2609290904LIVD6");
  assert.match(data.Texte6, /\+33 \(0\)6 21 32 07 37/);
});
