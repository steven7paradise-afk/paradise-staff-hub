import assert from "node:assert/strict";
import test from "node:test";
import { isPcCassaAllowedPath } from "../lib/pc-cassa-access";

test("the authorized cashier PC can open Shopify orders and its dashboard API", () => {
  assert.equal(isPcCassaAllowedPath("/shopify-orders"), true);
  assert.equal(isPcCassaAllowedPath("/shopify-orders/123"), true);
  assert.equal(isPcCassaAllowedPath("/api/shopify-orders-dashboard"), true);
  assert.equal(isPcCassaAllowedPath("/api/shopify-orders-dashboard/123"), true);
});

test("the cashier PC remains locked out of unrelated protected areas", () => {
  assert.equal(isPcCassaAllowedPath("/users"), false);
  assert.equal(isPcCassaAllowedPath("/settings"), false);
  assert.equal(isPcCassaAllowedPath("/api/users"), false);
});
