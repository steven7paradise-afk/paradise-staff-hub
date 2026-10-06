import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyOrderBlockToken, isOrderBlockState, orderReference } from "../lib/shopify-order-block";
const config = { secret: "test-secret", clientId: "test-app", shop: "test.myshopify.com", users: ["123"] };
const claims = { aud: config.clientId, dest: `https://${config.shop}`, iss: `https://${config.shop}/admin`, sub: "123", nbf: 999, exp: 1100 };
function token(changes = {}, secret = config.secret) {
  const head = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...claims, ...changes })).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}
test("Shopify block accepts only signed authorized users in the configured store and app", () => {
  assert.equal(verifyOrderBlockToken(token(), config, 1000000), "123");
  for (const change of [{aud:"other"}, {dest:"https://other.myshopify.com"}, {iss:"https://other/admin"}, {sub:"456"}, {exp:999}, {nbf:1100}]) {
    assert.throws(() => verifyOrderBlockToken(token(change), config, 1000000));
  }
  assert.throws(() => verifyOrderBlockToken(token({}, "wrong"), config, 1000000));
  assert.throws(() => verifyOrderBlockToken(token(), { ...config, users: [] }, 1000000));
});
test("only operational states and exact order references are accepted", () => {
  assert.equal(isOrderBlockState("COMPLETED"), true);
  for (const value of ["PAID", "FULFILLED", "__proto__", "ARCHIVED", null]) assert.equal(isOrderBlockState(value), false);
  assert.equal(orderReference("#24717"), "24717");
  assert.equal(orderReference("note #24717"), null);
});
