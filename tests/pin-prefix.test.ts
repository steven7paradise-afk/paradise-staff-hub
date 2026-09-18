import assert from "node:assert/strict";
import test from "node:test";
import { isPinPrefixValidForUser, pinPrefixLookup } from "../lib/pin";

test("verifica le prime due cifre del PIN senza ricostruire il PIN completo", () => {
  const storedPrefix = pinPrefixLookup("123456");

  assert.equal(isPinPrefixValidForUser("12", storedPrefix), true);
  assert.equal(isPinPrefixValidForUser("13", storedPrefix), false);
  assert.equal(isPinPrefixValidForUser("1", storedPrefix), false);
});
