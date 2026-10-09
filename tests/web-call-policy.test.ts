import test from "node:test";
import assert from "node:assert/strict";
import { webCallOriginAllowed, webCallActionAllowed } from "../lib/web-call-policy";
test("cookie-authenticated mutations reject missing, foreign and sibling origins", () => {
  assert.equal(webCallOriginAllowed(null, "https://my.staff-paradise.tech"), false);
  assert.equal(webCallOriginAllowed("https://evil.example", "https://my.staff-paradise.tech"), false);
  assert.equal(webCallOriginAllowed("https://www.staff-paradise.tech", "https://my.staff-paradise.tech"), false);
  assert.equal(webCallOriginAllowed("https://my.staff-paradise.tech", "https://my.staff-paradise.tech"), true);
});
test("web call bridge only exposes required actions", () => {
  assert.equal(webCallActionAllowed("calls", "accept"), true);
  assert.equal(webCallActionAllowed("directory", "create"), true);
  for (const action of ["send", "delete", "archive", "rename"]) assert.equal(webCallActionAllowed("directory", action), false);
  assert.equal(webCallActionAllowed("admin", "create"), false);
});
