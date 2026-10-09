import test from "node:test";
import assert from "node:assert/strict";
import { webLinkHash, webLinkAllowed } from "../lib/web-link-policy";
test("QR proof cannot be exchanged for a browser session", () => {
  const link = { proof: webLinkHash("phone-secret"), browser: webLinkHash("browser-secret"), expires: 200 };
  assert.equal(webLinkAllowed(link, "phone-secret", "proof", 100), true);
  assert.equal(webLinkAllowed(link, "browser-secret", "browser", 100), true);
  assert.equal(webLinkAllowed(link, "phone-secret", "browser", 100), false);
  assert.equal(webLinkAllowed(link, "browser-secret", "proof", 100), false);
  assert.equal(webLinkAllowed(link, "different-secret", "proof", 100), false);
});
test("expired, consumed and malformed challenges cannot authenticate", () => {
  const link = { proof: webLinkHash("secret"), browser: webLinkHash("other"), expires: 200 };
  assert.equal(webLinkAllowed(link, "secret", "proof", 200), false);
  assert.equal(webLinkAllowed(link, "secret", "proof", 201), false);
  assert.equal(webLinkAllowed(undefined, "secret", "proof", 100), false);
  assert.equal(webLinkAllowed({ ...link, proof: "invalid" }, "secret", "proof", 100), false);
});
