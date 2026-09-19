import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareGlitchtipEvent, safeGlitchtipRoute, sanitizeGlitchtipEvent } from "../lib/glitchtip";

test("GlitchTip retains stack coordinates but excludes private event data", () => {
  const clean = sanitizeGlitchtipEvent({
    type: undefined,
    user: { email: "private@example.test", ip_address: "127.0.0.1" },
    request: { url: "https://example.test/?customer=secret", headers: { Authorization: "secret" }, data: "invoice" },
    extra: { password: "secret" },
    breadcrumbs: [{ message: "private customer" }],
    exception: { values: [{ type: "TypeError", value: "Invoice for private@example.test", stacktrace: { frames: [{ filename: "/Users/private/app/page.tsx?token=secret", lineno: 12, colno: 4, vars: { password: "secret" } }] } }] },
  });
  const serialized = JSON.stringify(clean);
  for (const privateValue of ["private@example", "secret", "invoice", "/Users/", "password"]) assert.equal(serialized.includes(privateValue), false);
  assert.equal(clean.exception?.values?.[0].stacktrace?.frames?.[0].filename, "page.tsx");
  assert.equal(clean.exception?.values?.[0].stacktrace?.frames?.[0].lineno, 12);
});

test("GlitchTip preserves allowlisted generic network errors", () => {
  const clean = sanitizeGlitchtipEvent({ type: undefined, exception: { values: [{ type: "TypeError", value: "Failed to fetch" }] } });
  assert.equal(clean.exception?.values?.[0].value, "Failed to fetch");
});

test("GlitchTip keeps only a safe route without query strings or record identifiers", () => {
  assert.equal(safeGlitchtipRoute("https://example.test/service-forms/responses/secret-record?customer=private"), "/service-forms/responses/[id]");
  assert.equal(safeGlitchtipRoute("/shipping/stampa/8414141284698?token=secret"), "/shipping/stampa/[id]");
  assert.equal(safeGlitchtipRoute("/appointments/buenos-aires?customer=private"), "/appointments/buenos-aires");
});

test("GlitchTip tags React hydration errors with their code and safe route", () => {
  const clean = sanitizeGlitchtipEvent({
    type: undefined,
    request: { url: "https://example.test/appointments/buenos-aires?customer=private" },
    exception: { values: [{ type: "Error", value: "Minified React error #418" }] },
  });
  assert.equal(clean.tags?.react_error, "418");
  assert.equal(clean.tags?.app_route, "/appointments/buenos-aires");
});

test("GlitchTip drops React internal hydration sentinel 519", () => {
  const event = prepareGlitchtipEvent({
    type: undefined,
    exception: { values: [{ type: "Error", value: "Minified React error #519" }] },
  });
  assert.equal(event, null);
});
