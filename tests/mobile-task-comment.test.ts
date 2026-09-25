import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMobileTaskComment } from "../lib/mobile-task-comment";
const id = "12345678-1234-1234-1234-123456789abc";
test("validates and trims comments while preserving the retry identifier", () => {
  assert.deepEqual(parseMobileTaskComment({ message: "  Inizio adesso\nGrazie!  ", commentId: id }), { message: "Inizio adesso\nGrazie!", id });
  assert.ok(parseMobileTaskComment({ message: "x".repeat(5000), commentId: id }));
});
test("rejects empty, oversized, non-string comments and invalid identifiers", () => {
  for (const message of ["", "   ", "x".repeat(5001), 123, {}]) assert.equal(parseMobileTaskComment({ message, commentId: id }), null);
  for (const commentId of ["", "-".repeat(36), "bad-id", null]) assert.equal(parseMobileTaskComment({ message: "Test", commentId }), null);
});
