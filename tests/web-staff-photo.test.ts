import test from "node:test";
import assert from "node:assert/strict";
import { staffDrivePhotoId, staffPhotoSource } from "../lib/web-staff-photo";
test("worker photos resolve Drive references without granting arbitrary file access", () => {
  assert.equal(staffDrivePhotoId("/api/drive-image?id=abc_123"), "abc_123");
  assert.equal(staffDrivePhotoId("https://drive.google.com/file/d/abc-123/view"), "abc-123");
  for (const url of ["https://evil.example/api/drive-image?id=secret", "https://drive.google.com.evil.example/?id=secret", "/api/drive-image?id=../secret", "not a photo"]) assert.equal(staffDrivePhotoId(url), null);
  assert.equal(staffPhotoSource({ id: "worker", photo_url: "/api/drive-image?id=private" }), "/api/mobile/web-calls/photo?userId=worker");
  assert.equal(staffPhotoSource({ id: "worker", photo_url: "https://example.com/photo.jpg" }), "https://example.com/photo.jpg");
});
