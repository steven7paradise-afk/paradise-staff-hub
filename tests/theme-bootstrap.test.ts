import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { themeBootstrapScript, themeStorageKey } from "../lib/theme-bootstrap";

function runBootstrap(saved: string | null, failure?: "storage-access" | "storage-read", initiallyDark = false) {
  const classes = new Set(["unrelated", ...(initiallyDark ? ["dark"] : [])]);
  const reads: string[] = [];
  const window = {
    get localStorage() {
      if (failure === "storage-access") throw new Error("Storage unavailable");
      return { getItem(key: string) {
        reads.push(key);
        if (failure === "storage-read") throw new Error("Storage read denied");
        return saved;
      } };
    },
  };
  runInNewContext(themeBootstrapScript, {
    window,
    document: { documentElement: { classList: { toggle(name: string, enabled: boolean) {
      if (enabled) classes.add(name);
      else classes.delete(name);
    } } } },
    setTimeout() { assert.fail("Theme restoration must finish synchronously"); },
    requestAnimationFrame() { assert.fail("Theme restoration must not wait for another frame"); },
  });
  assert.equal(classes.has("unrelated"), true);
  return { dark: classes.has("dark"), reads };
}

test("saved dark theme applies synchronously before hydration", () => {
  assert.deepEqual(runBootstrap("dark"), { dark: true, reads: [themeStorageKey] });
});

test("saved light theme removes a stale dark class", () => {
  assert.deepEqual(runBootstrap("light", undefined, true), { dark: false, reads: [themeStorageKey] });
});

test("missing or unrecognized preferences keep the existing default light behavior", () => {
  for (const preference of [null, "", "system", "DARK"]) {
    assert.equal(runBootstrap(preference, undefined, true).dark, false);
  }
});

test("storage access or read failures safely fall back to light", () => {
  for (const failure of ["storage-access", "storage-read"] as const) {
    assert.equal(runBootstrap("dark", failure, true).dark, false);
  }
});
