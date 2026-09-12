import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../shopify-handoff.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("Shopify handoff prefers the standalone label service and keeps the migration route temporarily", () => {
  const handoff = manifest.content_scripts.find(entry => entry.js.includes("shopify-handoff.js"));
  assert.deepEqual(handoff.matches, [
    "https://chlabs-brother-label-api-1068150044836.europe-west9.run.app/shopify/brother-print*",
    "https://amazon-chronopost-direct-api-ajz3qng24a-od.a.run.app/shopify/brother-print*"
  ]);
  assert.match(source, /\^\[A-Za-z0-9_-\]\{43\}\$/);
  assert.match(source, /history\.replaceState\(null, "", location\.pathname\)/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /cache: "no-store"/);
});

test("Shopify jobs populate every required P-touch object", () => {
  for (const objectName of ["Texte6", "Texte10", "Code à barres1", "Code à barres10", "Date et heure8"])
    assert.ok(source.includes(`"${objectName}"`), `missing mapping for ${objectName}`);
  assert.match(source, /\[job\.destination, job\.phone\]\.filter\(Boolean\)\.join\("\\n"\)/);
  assert.match(source, /settings\.qrText/);
  assert.match(source, /job\.orderId/);
  assert.match(source, /parseDate\(job\.date\)/);
});

test("Shopify printing enforces replacement-model selection and production quality", () => {
  assert.match(source, /CheaplyPrinterSelector\.selectPrinter/);
  assert.match(source, /printerStatus\.documentMedia !== "62mm"/);
  assert.match(source, /fitPage: false/);
  assert.match(source, /autoCut: true/);
  assert.match(source, /quality: true/);
  assert.match(source, /highResolution: true/);
  assert.match(source, /highSpeed: false/);
});

test("printer check renders without printing and print mode sends exactly one copy", () => {
  assert.match(source, /value\.job\.mode === "check"/);
  assert.match(source, /instance\.getImageData\(data\)/);
  assert.match(source, /data:image\/png;base64/);
  assert.match(source, /brother-label-preview/);
  assert.match(source, /copies: 1/);
});
