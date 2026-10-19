import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { opaque, digest, equalHash, validVerifier, mayAuthorize, validRedirect, allowedOrigin, boundedBody } from "../lib/mcp/security";
import { romeDate, romeIso, dayStart, attendanceForDay } from "../lib/mcp/time";
import { OfficeConfig, DateKey } from "../lib/mcp/schemas";

test("OAuth restricts authorization to active administrators", () => {
  for (const role of ["ZERO", "SUPER_ADMIN", "ADMIN"]) assert.equal(mayAuthorize({ active: true, role }), true);
  for (const role of ["RESPONSABILE", "DIPENDENTE", "MAGAZZINO"]) assert.equal(mayAuthorize({ active: true, role }), false);
  assert.equal(mayAuthorize({ active: false, role: "ADMIN" }), false);
});
test("PKCE S256 requires a verifier and rejects modified or plaintext challenges", () => {
  const verifier = opaque(); const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(validVerifier(verifier, challenge), true);
  assert.equal(validVerifier(opaque(), challenge), false);
  assert.equal(validVerifier(verifier, verifier), false);
  assert.equal(validVerifier("short", challenge), false);
  assert.equal(equalHash(verifier, digest(verifier)), true); assert.equal(equalHash("wrong", digest(verifier)), false);
});
test("redirects require HTTPS without credentials or fragments; untrusted Origins rejected", () => {
  assert.equal(validRedirect("https://claude.ai/api/mcp/auth_callback"), true);
  for (const uri of ["javascript:alert(1)", "http://evil.test", "https://user:pass@evil.test", "https://claude.ai/#token"]) assert.equal(validRedirect(uri), false);
  assert.equal(allowedOrigin(new Request("https://www.staff-paradise.tech/mcp", { headers: { Origin: "https://evil.test" } })), false);
});
test("request body limit also applies without a content-length header", async () => {
  await assert.rejects(boundedBody(new Request("https://test", { method: "POST", body: "x".repeat(100) }), 10));
});
test("Rome dates use local midnight and DST offsets", () => {
  assert.equal(romeDate(new Date("2026-10-18T23:15:00Z")), "2026-10-19");
  assert.equal(romeIso(new Date("2026-07-01T07:00:00Z")), "2026-07-01T09:00:00+02:00");
  assert.equal(romeIso(new Date("2026-12-01T08:00:00Z")), "2026-12-01T09:00:00+01:00");
  assert.equal((dayStart("2026-10-26").getTime()-dayStart("2026-10-25").getTime())/3600000,25);
  assert.equal((dayStart("2026-03-30").getTime()-dayStart("2026-03-29").getTime())/3600000,23);
  assert.equal(DateKey.safeParse("2026-02-30").success, false);
});
const log = (type: string, timestamp: string) => ({ type, timestamp: new Date(timestamp) });
test("worked minutes exclude pauses, ignore duplicate entries and preserve multiple shifts", () => {
  const result = attendanceForDay([log("ENTRATA", "2026-10-19T09:00:00+02:00"), log("ENTRATA", "2026-10-19T09:10:00+02:00"), log("PAUSA", "2026-10-19T10:00:00+02:00"), log("RIENTRO", "2026-10-19T10:30:00+02:00"), log("USCITA", "2026-10-19T12:00:00+02:00"), log("ENTRATA", "2026-10-19T14:00:00+02:00")], "2026-10-19", new Date("2026-10-19T15:00:00+02:00"));
  assert.equal(result.worked_minutes, 210); assert.equal(result.breaks[0].minutes, 30); assert.equal(result.checked_out_at, null); assert.equal(result.status, "in_sede");
});
test("overnight work is clipped to the selected day; missing clocking never implies absence", () => {
  const result = attendanceForDay([log("ENTRATA", "2026-10-18T23:00:00+02:00"), log("USCITA", "2026-10-19T02:00:00+02:00")], "2026-10-19", new Date("2026-10-19T12:00:00+02:00"));
  assert.equal(result.worked_minutes, 120); assert.equal(result.checked_in_at, "2026-10-18T23:00:00+02:00");
  assert.equal(attendanceForDay([], "2026-10-19", new Date()).status, "non_timbrato");
});
test("department config rejects ambiguous assignments and lead from another department", () => {
  assert.equal(OfficeConfig.safeParse({ employees: [{ employee_id: "a", department_key: "ecom", public_role: "" }], departments: [{ key: "mkt", lead_employee_id: "a", capacity: 2 }], task_texts: [] }).success, false);
});
