import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeGlitchtipEvent } from "../lib/glitchtip";

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
