import test from "node:test";
import assert from "node:assert/strict";
import { issueOfflineGrant, verifyOfflineGrant, OFFLINE_ACCESS_SECONDS, offlineFingerprint } from "../lib/appointments-offline-grant";

const now = 1_800_000_000_000;
const secret = "test-only-secret-never-used-in-production";

test("grant binds worker, device and credential version without exposing PIN/hash", () => {
  const issued = issueOfflineGrant("worker-1", "device-secret", "stored-pin-hash", "DIPENDENTE", secret, now);
  const verified = verifyOfflineGrant(issued.token, "device-secret", secret, now);
  assert.equal(verified?.workerId, "worker-1");
  assert.equal(verified?.credential, offlineFingerprint("stored-pin-hash"));
  assert.equal(verified?.role, "DIPENDENTE");
  const payload = Buffer.from(issued.token.split(".")[0], "base64url").toString();
  assert.ok(!payload.includes("stored-pin-hash"));
  assert.ok(!payload.includes("device-secret"));
});

test("wrong device, signing key, tampering, malformed or oversized tokens fail closed", () => {
  const { token } = issueOfflineGrant("worker-1", "device", "hash", "DIPENDENTE", secret, now);
  assert.equal(verifyOfflineGrant(token, "other-device", secret, now), null);
  assert.equal(verifyOfflineGrant(token, "device", "other-key", now), null);
  const [payload, signature] = token.split(".");
  const changed = Buffer.from(Buffer.from(payload, "base64url").toString().replace("worker-1", "worker-2")).toString("base64url");
  for (const invalid of [`${changed}.${signature}`, `${token}.extra`, "not-a-token", "x".repeat(3000)]) {
    assert.equal(verifyOfflineGrant(invalid, "device", secret, now), null);
  }
});

test("24 hour expiry and future-issued grants are rejected", () => {
  const { token } = issueOfflineGrant("w", "d", "h", "DIPENDENTE", secret, now);
  assert.ok(verifyOfflineGrant(token, "d", secret, now + (OFFLINE_ACCESS_SECONDS - 1) * 1000));
  assert.equal(verifyOfflineGrant(token, "d", secret, now + OFFLINE_ACCESS_SECONDS * 1000), null);
  assert.equal(verifyOfflineGrant(token, "d", secret, now - 1000), null);
  assert.throws(() => issueOfflineGrant("w", "d", "h", "DIPENDENTE", "", now));
});
