import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { signAppointmentPcArrival } from "../lib/appointment-pc-arrival-session";
import { signAppointmentPcReception, verifyAppointmentPcReception } from "../lib/appointment-pc-reception-session";

const USER = "fixture-receptionist";
const LOCATION = "fixture-repubblica";
const DEVICE = "fixture-authorized-device";
const SECRET = "synthetic-reception-signing-secret";
const NOW = Date.parse("2026-11-18T13:30:00.000Z");

test("Reception is signed for one Rome calendar day and expires at midnight", () => {
  const grant = signAppointmentPcReception(USER, LOCATION, DEVICE, SECRET, NOW);
  assert.equal(grant.expiresAt, Date.parse("2026-11-18T23:00:00.000Z"));
  assert.equal(grant.maxAge, 9.5 * 3600);
  assert.deepEqual(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, NOW), {
    userId: USER, expiresAt: grant.expiresAt,
  });
  assert.ok(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, grant.expiresAt - 1));
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, grant.expiresAt), null);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, NOW - 1), null);
});

test("Rome midnight handles the 23-hour and 25-hour daylight-saving days", () => {
  for (const [start, end, hours] of [
    ["2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z", 23],
    ["2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z", 25],
  ] as const) {
    const issuedAt = Date.parse(start);
    const grant = signAppointmentPcReception(USER, LOCATION, DEVICE, SECRET, issuedAt);
    assert.equal(grant.expiresAt, Date.parse(end));
    assert.equal(grant.maxAge, hours * 3600);
    assert.ok(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, grant.expiresAt - 1));
    assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, grant.expiresAt), null);
  }
});

test("a last-millisecond grant still expires exactly at Rome midnight", () => {
  const midnight = Date.parse("2026-11-18T23:00:00Z");
  const grant = signAppointmentPcReception(USER, LOCATION, DEVICE, SECRET, midnight - 1);
  assert.equal(grant.maxAge, 1);
  assert.equal(grant.expiresAt, midnight);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, midnight), null);
});

test("the signature binds the operator, location, device, dates and Reception purpose", () => {
  const grant = signAppointmentPcReception(USER, LOCATION, DEVICE, SECRET, NOW);
  assert.equal(verifyAppointmentPcReception(grant.token, "other-device", LOCATION, SECRET, NOW), null);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, "other-site", SECRET, NOW), null);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, "other-secret", NOW), null);
  for (const token of [
    grant.token.replace(USER, "fixture-admin"),
    grant.token.replace(LOCATION, "other-site"),
    grant.token.replace("2026-11-18", "2026-11-19"),
    grant.token.replace(String(grant.expiresAt), String(grant.expiresAt + 3600_000)),
  ]) assert.equal(verifyAppointmentPcReception(token, DEVICE, LOCATION, SECRET, NOW), null);

  const payload = grant.token.slice(0, grant.token.lastIndexOf("."));
  const arrivalPurposeSignature = createHmac("sha256", SECRET)
    .update(`paradise-pc-arrival-v1:${DEVICE}:${payload}`).digest("base64url");
  assert.equal(verifyAppointmentPcReception(`${payload}.${arrivalPurposeSignature}`, DEVICE, LOCATION, SECRET, NOW), null);
  const signed = grant.token.slice(grant.token.lastIndexOf(".") + 1);
  const changed = Buffer.from(signed, "base64url");
  changed[0] ^= 1;
  assert.equal(verifyAppointmentPcReception(`${payload}.${changed.toString("base64url")}`, DEVICE, LOCATION, SECRET, NOW), null);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const alias = signed.slice(0, -1) + alphabet[alphabet.indexOf(signed.at(-1)!) + 1];
  assert.deepEqual(Buffer.from(alias, "base64url"), Buffer.from(signed, "base64url"));
  assert.equal(verifyAppointmentPcReception(`${payload}.${alias}`, DEVICE, LOCATION, SECRET, NOW), null);
  const arrival = signAppointmentPcArrival(USER, DEVICE, true, SECRET, NOW + 300_000);
  assert.equal(verifyAppointmentPcReception(arrival, DEVICE, LOCATION, SECRET, NOW), null);
});

test("malformed grants and signing inputs fail closed", () => {
  const grant = signAppointmentPcReception(USER, LOCATION, DEVICE, SECRET, NOW);
  for (const token of [undefined, "", "invalid", "x".repeat(513), `${grant.token}.extra`]) {
    assert.equal(verifyAppointmentPcReception(token, DEVICE, LOCATION, SECRET, NOW), null);
  }
  assert.equal(verifyAppointmentPcReception(grant.token, undefined, LOCATION, SECRET, NOW), null);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, undefined, SECRET, NOW), null);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, undefined, NOW), null);
  assert.equal(verifyAppointmentPcReception(grant.token, DEVICE, LOCATION, SECRET, NaN), null);
  for (const [user, location, device, secret, now] of [
    ["", LOCATION, DEVICE, SECRET, NOW],
    [USER, "invalid.site", DEVICE, SECRET, NOW],
    [USER, LOCATION, "", SECRET, NOW],
    [USER, LOCATION, DEVICE, "", NOW],
    [USER, LOCATION, DEVICE, SECRET, Infinity],
  ] as const) assert.throws(() => signAppointmentPcReception(user, location, device, secret, now));
});
