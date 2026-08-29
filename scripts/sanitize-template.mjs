import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../template-source/final/label.xml", import.meta.url);
let xml = await readFile(path, "utf8");
replaceData("barcode:barcode", "Code à barres1", "Sender details");
replaceData("barcode:barcode", "Code à barres10", "000-0000000-0000000");
replaceData("text:text", "Texte6", "Destination");
replaceData("text:text", "Texte10", "Account\nmodel");
replaceTextControl("Texte6", 'control="FREE" clipFrame="true" aspectNormal="true" shrink="false" autoLF="true" avoidImage="false"');
await writeFile(path, xml, "utf8");
console.log("Sanitized dynamic placeholders in the P-touch template source.");

function replaceData(kind, objectName, value) {
  const escapedKind = kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedName = objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<${escapedKind}>(?:(?!</${escapedKind}>)[\\s\\S])*?objectName="${escapedName}"(?:(?!</${escapedKind}>)[\\s\\S])*?<pt:data>)[\\s\\S]*?(</pt:data>)`);
  if (!pattern.test(xml)) throw new Error(`Template object ${objectName} was not found`);
  xml = xml.replace(pattern, `$1${value}$2`);
}

function replaceTextControl(objectName, attributes) {
  const escapedName = objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<text:text>(?:(?!</text:text>)[\\s\\S])*?objectName="${escapedName}"(?:(?!</text:text>)[\\s\\S])*?<text:textControl)\\s+[^>]*(/>)`);
  if (!pattern.test(xml)) throw new Error(`Template text control ${objectName} was not found`);
  xml = xml.replace(pattern, `$1 ${attributes}$2`);
}
