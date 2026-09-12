import { deflateRawSync } from "node:zlib";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));

const extensionFiles = [
  "manifest.json", "service-worker.js", "content.js", "content.css", "parser.js", "octopia-parser.js", "printer-selector.js", "route-guard.js", "shopify-handoff.js",
  "options.html", "options.js", "options.css", "print.html", "print.js", "print.css",
  "bpac-sdk.js", "BPAC_JS_LICENSE.txt", "qrcode.js", "qrcode_UTF8.js",
  "THIRD_PARTY_NOTICES.txt", "logo.bmp", "address-62mm-bottom-code128.lbx"
];
const localFiles = [
  ...extensionFiles,
  "README.md", "INSTALL.md", "installer/setup-windows.ps1", "installer/setup-windows.cmd"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeZipFromEntries(new URL("address-62mm-bottom-code128.lbx", dist), await entriesFrom("template-source/final/", ["label.xml", "prop.xml", "Object0.bmp"]));
await writeZip(new URL(`amazon-brother-package-label-${manifest.version}-store.zip`, dist), extensionFiles);
await writeZip(new URL(`amazon-brother-package-label-${manifest.version}-local.zip`, dist), localFiles);
console.log(`Built Store and local-install packages for ${manifest.version}.`);

async function writeZip(destination, files) {
  await writeZipFromEntries(destination, await entriesFrom("", files));
}

async function entriesFrom(prefix, files) {
  const entries = [];
  for (const name of files) {
    const source = !prefix && name === "address-62mm-bottom-code128.lbx" ? new URL(name, dist) : new URL(`${prefix}${name}`, root);
    entries.push({ name: name.replaceAll("\\", "/"), data: await readFile(source) });
  }
  return entries;
}

async function writeZipFromEntries(destination, entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x5c21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5c21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, value) => sum + value.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  await writeFile(destination, Buffer.concat([...locals, ...centrals, end]));
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
