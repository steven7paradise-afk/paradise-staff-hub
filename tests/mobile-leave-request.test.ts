import test from "node:test";
import assert from "node:assert/strict";
import { personalLeavePayload, medicalCodePayload } from "../lib/mobile-leave-request";
const base = { id: "19ce6611-7637-4390-87d2-7c4122129345", type: "FERIE", startDate: "2026-10-10", endDate: "2026-10-12", reason: "Ferie" };
test("accepts valid leave and excludes supplied identity and approval", () => {
  const r = personalLeavePayload({ ...base, user_id: "someone-else", status: "APPROVED" });
  assert.ok(r); assert.equal("user_id" in r, false); assert.equal("status" in r, false);
});
test("rejects invalid calendar dates, inverted ranges and unknown types", () => {
  assert.equal(personalLeavePayload({ ...base, startDate: "2026-02-30" }), null);
  assert.equal(personalLeavePayload({ ...base, endDate: "2026-10-09" }), null);
  assert.equal(personalLeavePayload({ ...base, type: "ALTRO" }), null);
});
test("hourly permissions require a same-day valid interval", () => {
  const p = { ...base, type: "PERMESSO", endDate: base.startDate, startTime: "09:00", endTime: "10:00" };
  assert.ok(personalLeavePayload(p));
  assert.equal(personalLeavePayload({ ...p, endTime: "08:00" }), null);
  assert.equal(personalLeavePayload({ ...p, endTime: "25:00" }), null);
  assert.equal(personalLeavePayload({ ...p, endDate: "2026-10-12" }), null);
  assert.equal(personalLeavePayload({ ...p, startTime: null }), null);
});

test("sickness stores protocol and distinguishes missing certificate", () => {
  const certified = personalLeavePayload({ ...base, type: "MALATTIA", medicalCode: " 123456 " });
  assert.equal(certified?.medical_code, "123456");
  assert.equal(certified?.sickness_unjustified, false);
  assert.equal(personalLeavePayload({ ...base, type: "MALATTIA" })?.sickness_unjustified, true);
  assert.equal(personalLeavePayload({ ...base, medicalCode: "123456" })?.medical_code, null);
  assert.equal(personalLeavePayload({ ...base, type: "MALATTIA", startTime: "09:00", endTime: "10:00" }), null);
});

test("workers cannot submit delays, including through older clients", () => {
  assert.equal(personalLeavePayload({ ...base, type: "RITARDO" }), null);
  assert.equal(personalLeavePayload({ ...base, type: "RITARDO", endDate: base.startDate, startTime: "09:00", endTime: "09:30" }), null);
});

test("certificate update requires nonempty bounded code and excludes identity/status fields", () => {
  assert.deepEqual(medicalCodePayload({ id: "legacy-request-id", medicalCode: " 123456 ", user_id: "other", status: "APPROVED" }),
    { id: "legacy-request-id", medicalCode: "123456" });
  for (const medicalCode of [null, 123, "", "  ", "x".repeat(201)]) {
    assert.equal(medicalCodePayload({ id: "request", medicalCode }), null);
  }
  assert.equal(medicalCodePayload({ medicalCode: "123" }), null);
});
