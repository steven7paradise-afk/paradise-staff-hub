import test from "node:test";
import assert from "node:assert/strict";
import { appointmentPinKey } from "../lib/appointment-pin-keyboard";

const key = (value: string, overrides = {}) => appointmentPinKey({
  key: value, ctrlKey: false, metaKey: false, altKey: false,
  repeat: false, isComposing: false, ...overrides,
});

test("physical keyboard accepts all digits including leading zero", () => {
  for (const digit of "0123456789") assert.equal(key(digit), digit);
});
test("keyboard supports correction and explicit submission", () => {
  assert.equal(key("Backspace"), "backspace");
  assert.equal(key("Delete"), "clear");
  assert.equal(key("Enter"), "submit");
});
test("does not capture navigation, shortcuts, held keys or composition", () => {
  for (const value of ["Tab", "Escape", "ArrowLeft", "a", "+"]) assert.equal(key(value), null);
  for (const modifier of ["ctrlKey", "metaKey", "altKey", "repeat", "isComposing"]) {
    assert.equal(key("1", { [modifier]: true }), null);
    assert.equal(key("Enter", { [modifier]: true }), null);
  }
});
