import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version, "manifest and package versions must match");
assert.deepEqual(manifest.permissions, ["storage"]);
const sellerCentralOrigins = [
  "https://sellercentral.amazon.com",
  "https://sellercentral.amazon.ca",
  "https://sellercentral.amazon.com.mx",
  "https://sellercentral.amazon.com.br",
  "https://sellercentral.amazon.ie",
  "https://sellercentral-europe.amazon.com",
  "https://sellercentral.amazon.fr",
  "https://sellercentral.amazon.co.uk",
  "https://sellercentral.amazon.de",
  "https://sellercentral.amazon.es",
  "https://sellercentral.amazon.it",
  "https://sellercentral.amazon.com.be",
  "https://sellercentral.amazon.nl",
  "https://sellercentral.amazon.se",
  "https://sellercentral.amazon.co.za",
  "https://sellercentral.amazon.pl",
  "https://sellercentral.amazon.eg",
  "https://sellercentral.amazon.com.tr",
  "https://sellercentral.amazon.sa",
  "https://sellercentral.amazon.ae",
  "https://sellercentral.amazon.in",
  "https://sellercentral.amazon.sg",
  "https://sellercentral.amazon.com.au",
  "https://sellercentral.amazon.co.jp"
];
const amazonContentScript = manifest.content_scripts.find(({ js = [] }) => js.includes("content.js"));
assert.ok(amazonContentScript, "Amazon content script must exist");
const bpacResource = manifest.web_accessible_resources.find(({ resources = [] }) => resources.includes("bpac-sdk.js"));
assert.ok(bpacResource, "b-PAC web-accessible resource must exist");
for (const origin of sellerCentralOrigins) {
  assert.ok(manifest.host_permissions.includes(`${origin}/orders-v3/order/*`), `missing order permission for ${origin}`);
  assert.ok(amazonContentScript.matches.includes(`${origin}/*`), `missing content script match for ${origin}`);
  assert.ok(bpacResource.matches.includes(`${origin}/*`), `missing b-PAC resource match for ${origin}`);
}
assert.ok(manifest.host_permissions.includes("https://amazon-chronopost-direct-api-ajz3qng24a-od.a.run.app/shopify/brother-print*"));
assert.ok(manifest.host_permissions.includes("https://seller.octopia.com/Order/Detail/*"));
assert.ok(amazonContentScript.matches.includes("https://seller.octopia.com/Order/Detail/*"));
assert.ok(bpacResource.matches.includes("https://seller.octopia.com/*"));

const required = [
  "manifest.json", "service-worker.js", "content.js", "content.css", "parser.js", "octopia-parser.js", "printer-selector.js", "route-guard.js", "label-data.js", "shopify-handoff.js",
  "options.html", "options.js", "options.css", "bpac-sdk.js",
  "template-source/final/label.xml", "template-source/final/prop.xml",
  "template-source/final/Object0.bmp", "BPAC_JS_LICENSE.txt", "THIRD_PARTY_NOTICES.txt"
];
for (const file of required) assert.ok((await stat(new URL(file, root))).isFile(), `missing ${file}`);

const sourceFiles = ["manifest.json", "service-worker.js", "options.js", "content.js", "parser.js", "octopia-parser.js", "printer-selector.js", "route-guard.js", "label-data.js", "shopify-handoff.js", "README.md"];
const source = (await Promise.all(sourceFiles.map((file) => readFile(new URL(file, root), "utf8")))).join("\n");
assert.ok(!source.includes("C:\\\\Users\\\\frees") && !source.includes("C:\\Users\\frees"), "release source contains a user-specific Windows path");
assert.ok(!/4 rue de broglie|33662775987/i.test(source), "release source contains private sender details");
assert.ok(source.includes("C:\\\\Users\\\\Public\\\\Documents\\\\Chlabs\\\\AmazonBrotherPackageLabel") || source.includes("C:\\Users\\Public\\Documents\\Chlabs\\AmazonBrotherPackageLabel"));

const templateXml = await readFile(new URL("template-source/final/label.xml", root), "utf8");
assert.ok(!/4 rue de broglie|33662775987/i.test(templateXml), "P-touch source contains private sender details");
for (const objectName of ["Texte6", "Texte10", "Code à barres1", "Code à barres10", "Date et heure8"]) {
  assert.ok(templateXml.includes(`objectName="${objectName}"`), `P-touch template is missing ${objectName}`);
}
assert.match(templateXml, /protocol="CODE128"/);
assert.match(templateXml, /objectName="Texte6"[\s\S]*?<text:textControl control="FREE" clipFrame="true" aspectNormal="true" shrink="false" autoLF="true"/);
console.log(`Validated Amazon Brother Package Label ${manifest.version}.`);
