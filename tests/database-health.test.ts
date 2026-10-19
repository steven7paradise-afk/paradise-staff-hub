import test from "node:test";
import assert from "node:assert/strict";
import { createDatabaseHealthCheck } from "../lib/database-health";

test("concurrent probes share one database query and cache success", async () => {
  let calls = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const check = createDatabaseHealthCheck(() => { calls++; return pending; });
  const results = [check(), check(), check()];
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  assert.deepEqual(await Promise.all(results), [true, true, true]);
  assert.equal(await check(), true);
  assert.equal(calls, 1);
});

test("a stalled pool fails within the deadline without piling up queries, then recovers", async () => {
  let calls = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const check = createDatabaseHealthCheck(() => { calls++; return pending; }, { timeoutMs: 10, cacheMs: 0 });
  assert.equal(await check(), false);
  assert.equal(await check(), false);
  assert.equal(calls, 1);
  finish();
  assert.equal(await check(), true);
});

test("failed database requests can recover and never expose errors", async () => {
  let calls = 0;
  const check = createDatabaseHealthCheck(async () => {
    if (++calls === 1) throw new Error("private connection details");
  }, { cacheMs: 0 });
  assert.equal(await check(), false);
  assert.equal(await check(), true);
  assert.equal(calls, 2);
});

test("synchronous initialization failures are reported as unhealthy", async () => {
  const check = createDatabaseHealthCheck(() => { throw new Error("initialization failed"); });
  assert.equal(await check(), false);
});
