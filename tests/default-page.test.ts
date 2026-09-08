import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PAGE_OPTIONS, isDefaultPagePath, normalizeDefaultPage } from "../lib/default-page";
import { routePermissions } from "../lib/roles";

test("accetta soltanto pagine iniziali interne previste", () => {
  assert.equal(isDefaultPagePath("/tasks"), true);
  assert.equal(normalizeDefaultPage(" /profile "), "/profile");
  assert.equal(normalizeDefaultPage("https://example.com"), null);
  assert.equal(normalizeDefaultPage("//example.com"), null);
});

test("non espone pagine iniziali duplicate", () => {
  const paths = DEFAULT_PAGE_OPTIONS.map((option) => option.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.every((path) => Boolean(routePermissions[path])), true);
});
