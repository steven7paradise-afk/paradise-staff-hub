import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyCowlendarSignature, BOOKING_EVENTS } from "../lib/cowlendar-webhook";

const secret = "whsec_test_only";
const timestamp = "1800000000";
const body = Buffer.from('{"name":"È una prova"}');
const hash = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
const signature = `t=${timestamp},v1=${hash}`;
const now = Number(timestamp) * 1000;
test("accepts a signed raw Unicode payload", () => {
  assert.equal(verifyCowlendarSignature(body, timestamp, signature, secret, now), true);
});
test("rejects altered body, secret, signature or timestamp", () => {
  assert.equal(verifyCowlendarSignature(Buffer.from("{}"), timestamp, signature, secret, now), false);
  assert.equal(verifyCowlendarSignature(body, timestamp, signature, "wrong", now), false);
  assert.equal(verifyCowlendarSignature(body, timestamp, "t=1800000000,v1=no", secret, now), false);
  assert.equal(verifyCowlendarSignature(body, timestamp, signature.replace("t=1800000000", "t=1800000001"), secret, now), false);
});
test("rejects stale and future replay and malformed timestamps", () => {
  for (const delta of [-301000, 301000]) {
    assert.equal(verifyCowlendarSignature(body, timestamp, signature, secret, now + delta), false);
  }
  assert.equal(verifyCowlendarSignature(body, "NaN", signature, secret, now), false);
  assert.equal(verifyCowlendarSignature(body, timestamp, `${signature},t=${timestamp}`, secret, now), false);
});
test("only booking events trigger agenda invalidation", () => {
  assert.equal(BOOKING_EVENTS.has("booking.created"), true);
  assert.equal(BOOKING_EVENTS.has("booking.rescheduled"), true);
  assert.equal(BOOKING_EVENTS.has("webhook.ping"), false);
  assert.equal(BOOKING_EVENTS.has("subscription.created"), false);
});
