import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const context = { globalThis: {} };
vm.runInNewContext(await readFile(new URL("../label-data.js", import.meta.url), "utf8"), context);
const data = context.globalThis.CheaplyLabelData;

test("keeps a four-line address and puts the phone on the final line", () => {
  assert.equal(
    data.destinationWithPhone("Name\nStreet\n75001 Paris\nFR", "0621320737"),
    "Name\nStreet\n75001 Paris\nFR · Tél. 0621320737"
  );
});

test("normalizes Windows newlines and whitespace", () => {
  assert.equal(data.destinationWithPhone(" Name\r\n Street \r\n FR ", " 06 21 32 07 37 "), "Name\nStreet\nFR · Tél. 06 21 32 07 37");
});

test("handles missing address or phone without producing blank lines", () => {
  assert.equal(data.destinationWithPhone("", "0600000000"), "Tél. 0600000000");
  assert.equal(data.destinationWithPhone("Name\nFR", ""), "Name\nFR");
  assert.equal(data.destinationWithPhone("", ""), "");
});

test("does not duplicate a phone already present in the address", () => {
  assert.equal(data.destinationWithPhone("Name\nFR · Tél. 0600000000", "0600000000"), "Name\nFR · Tél. 0600000000");
});

test("keeps long international numbers intact", () => {
  assert.match(data.destinationWithPhone("Name\nFR", "+33 6 21 32 07 37"), /\+33 6 21 32 07 37$/);
});
