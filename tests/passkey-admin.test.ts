import assert from "node:assert/strict";
import test from "node:test";
import {
  canUsePasskeyGrant,
  isAdminRole,
  passkeyLoginChallengeDeviceId,
  passkeyRegistrationChallengeDeviceId,
} from "../lib/passkey";

test("Face ID Tablet Clock accepts only administrative roles", () => {
  assert.equal(isAdminRole("ZERO"), true);
  assert.equal(isAdminRole("SUPER_ADMIN"), true);
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("RESPONSABILE"), false);
  assert.equal(isAdminRole("MAGAZZINO"), false);
  assert.equal(isAdminRole("DIPENDENTE"), false);
  assert.equal(isAdminRole(undefined), false);
});

test("personal app login accepts every active staff role", () => {
  assert.equal(canUsePasskeyGrant("ZERO", "LOGIN"), true);
  assert.equal(canUsePasskeyGrant("RESPONSABILE", "LOGIN"), true);
  assert.equal(canUsePasskeyGrant("MAGAZZINO", "LOGIN"), true);
  assert.equal(canUsePasskeyGrant("DIPENDENTE", "LOGIN"), true);
});

test("attendance passkey remains restricted to administrative roles", () => {
  assert.equal(canUsePasskeyGrant("ADMIN", "ATTENDANCE"), true);
  assert.equal(canUsePasskeyGrant("DIPENDENTE", "ATTENDANCE"), false);
});

test("personal login challenge is isolated behind a one-way flow identifier", () => {
  const first = passkeyLoginChallengeDeviceId("flow-one");
  const second = passkeyLoginChallengeDeviceId("flow-two");
  assert.match(first, /^app-login:[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.equal(first.includes("flow-one"), false);
});

test("PIN registration challenge is separate from login and does not expose its flow", () => {
  const login = passkeyLoginChallengeDeviceId("same-flow");
  const registration = passkeyRegistrationChallengeDeviceId("same-flow");
  assert.match(registration, /^registration:[a-f0-9]{64}$/);
  assert.notEqual(login, registration);
  assert.equal(registration.includes("same-flow"), false);
});
