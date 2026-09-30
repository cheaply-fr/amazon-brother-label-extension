import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const context = { globalThis: {} };
vm.runInNewContext(await readFile(new URL("../printer-selector.js", import.meta.url), "utf8"), context);
const selector = context.globalThis.CheaplyPrinterSelector;

test("recognizes replacement printer names for the same model", () => {
  assert.equal(selector.modelKey("Brother QL-700 (Copy 1)"), "ql-700");
  assert.deepEqual(
    Array.from(selector.sameModelPrinters(["Brother QL-800", "Brother QL-700 (Copy 1)"], "Brother QL-700")),
    ["Brother QL-700 (Copy 1)"]
  );
});

test("falls back from an offline original to an online replacement", async () => {
  const result = await selector.selectPrinter(
    ["Brother QL-700", "Brother QL-700 (Copie 1)"],
    "Brother QL-700",
    async (name) => ({ online: name.includes("Copie"), supported: true, errorCode: 0 })
  );
  assert.equal(result.printerName, "Brother QL-700 (Copie 1)");
});

test("rejects a different Brother model", async () => {
  await assert.rejects(
    selector.selectPrinter(["Brother QL-800"], "Brother QL-700", async () => ({ online: true })),
    /No installed QL-700 printer/
  );
});

test("deduplicates replacement names and prefers the exact configured printer", () => {
  assert.deepEqual(
    Array.from(selector.sameModelPrinters(["Brother QL-700 (Copy 1)", "Brother QL-700", "Brother QL-700", "Brother QL-800"], "Brother QL-700")),
    ["Brother QL-700", "Brother QL-700 (Copy 1)"]
  );
});

test("rejects an unparseable configured printer model", () => {
  assert.throws(() => selector.sameModelPrinters(["Brother QL-700"], "Brother Printer"), /Cannot determine the Brother model/);
});

test("continues after unsupported and error-status printers", async () => {
  const seen = [];
  const result = await selector.selectPrinter(
    ["Brother QL-700", "Brother QL-700 (Copy 2)", "Brother QL-700 (Copy 3)"],
    "Brother QL-700",
    async (name) => {
      seen.push(name);
      if (name === "Brother QL-700") return { online: false, supported: true, errorCode: 0 };
      if (name.endsWith("Copy 2)")) return { online: true, supported: false };
      if (name.endsWith("Copy 3)")) return { online: true, supported: true, errorCode: 0 };
      return { online: true, supported: true, errorCode: 0 };
    }
  );
  assert.equal(result.printerName, "Brother QL-700 (Copy 3)");
  assert.deepEqual(seen, ["Brother QL-700", "Brother QL-700 (Copy 2)", "Brother QL-700 (Copy 3)"]);
});
