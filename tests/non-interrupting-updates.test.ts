import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("activating the service worker never navigates an open page", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  let claimed = 0;
  let enumerated = 0;
  let completion: Promise<unknown> | undefined;
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
      clients: {
        claim: async () => { claimed++; },
        matchAll: async () => { enumerated++; throw new Error("Must not navigate clients"); },
      },
    },
  });
  handlers.activate({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
  await completion;
  assert.equal(claimed, 1);
  assert.equal(enumerated, 0);
});

test("a new version only shows an optional notice; reloading requires confirmation", async () => {
  const state = [false, false];
  let stateIndex = 0;
  let effect: (() => void) | undefined;
  const timers: (() => Promise<void>)[] = [];
  let reloads = 0;
  let confirmed = false;
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync("components/app-version-watcher.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  vm.runInNewContext(code, {
    exports,
    require: (name: string) => name === "react" ? {
      useState: () => { const index = stateIndex++; return [state[index], (value: boolean) => { state[index] = value; }]; },
      useEffect: (callback: () => void) => { effect = callback; },
    } : { jsx, jsxs: jsx },
    navigator: { onLine: true },
    document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
    window: {
      setTimeout: (callback: () => Promise<void>) => { timers.push(callback); return 1; },
      setInterval: (callback: () => Promise<void>) => { timers.push(callback); return 2; },
      clearTimeout() {}, clearInterval() {}, addEventListener() {}, removeEventListener() {},
      confirm: () => confirmed,
      location: { reload: () => { reloads++; } },
    },
    fetch: async () => ({ ok: true, json: async () => ({ version: "new" }) }),
  });
  assert.equal(exports.AppVersionWatcher({ currentVersion: "old" }), null);
  effect!();
  for (const timer of timers) await timer();
  assert.equal(state[0], true);
  assert.equal(reloads, 0);
  stateIndex = 0;
  const notice = exports.AppVersionWatcher({ currentVersion: "old" });
  const buttons = notice.props.children[2].props.children;
  buttons[1].props.onClick();
  assert.equal(reloads, 0);
  confirmed = true;
  buttons[1].props.onClick();
  assert.equal(reloads, 1);
  buttons[0].props.onClick();
  stateIndex = 0;
  assert.equal(exports.AppVersionWatcher({ currentVersion: "old" }), null);
});
