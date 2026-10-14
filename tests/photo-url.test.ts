import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthenticatedPhotoUrl } from "../lib/photo-url";

test("payroll photos keep private Drive references on the authenticated origin", () => {
  for (const source of ["/api/drive-image?id=photo_123", "https://staff-paradise.tech/api/drive-image?id=photo_123", "https://drive.google.com/file/d/photo_123/view", "https://drive.google.com/thumbnail?id=photo_123&sz=w1200"]) {
    assert.equal(resolveAuthenticatedPhotoUrl(source), "/api/drive-image?id=photo_123");
  }
  assert.equal(resolveAuthenticatedPhotoUrl("https://cdn.example/avatar.jpg"), "https://cdn.example/avatar.jpg");
  assert.equal(resolveAuthenticatedPhotoUrl(null), "");
});
