import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const context = { globalThis: {}, URL };
vm.runInNewContext(await readFile(new URL("../route-guard.js", import.meta.url), "utf8"), context);
const { isOrderDetailsPage } = context.globalThis.CheaplyLabelRoute;

test("shows the label button on old and current Amazon order-detail URLs", () => {
  assert.equal(isOrderDetailsPage("https://sellercentral.amazon.fr/orders-v3/order/407-1681538-9362754"), true);
  assert.equal(isOrderDetailsPage("https://sellercentral.amazon.es/orders-v3/order/407-1681538-9362754?ref=orders"), true);
  assert.equal(isOrderDetailsPage("/orders-v3/order/407-1681538-9362754/"), true);
});

test("hides the label button from packing slips and print-related subpages", () => {
  assert.equal(isOrderDetailsPage("https://sellercentral.amazon.fr/orders/packing-slip?orderId=407-1681538-9362754"), false);
  assert.equal(isOrderDetailsPage("https://sellercentral.amazon.fr/orders-v3/order/407-1681538-9362754/buy-shipping"), false);
  assert.equal(isOrderDetailsPage("https://sellercentral.amazon.fr/orders-v3/mfn/unshipped?orderId=407-1681538-9362754"), false);
});

test("shows the label button only on Octopia order-detail pages", () => {
  assert.equal(isOrderDetailsPage("https://seller.octopia.com/Order/Detail/63010bad630944a4bfd4ae292a098c85"), true);
  assert.equal(isOrderDetailsPage("https://seller.octopia.com/order/all"), false);
  assert.equal(isOrderDetailsPage("https://seller.octopia.com/Order/Detail/not-an-order"), false);
});

test("rejects malformed and missing order IDs", () => {
  assert.equal(isOrderDetailsPage("not a valid URL"), false);
  assert.equal(isOrderDetailsPage("https://sellercentral.amazon.fr/orders-v3/order/407-123"), false);
});
