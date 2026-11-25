import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

type Bucket = { count: number; expires_at: Date };
type ReturnedBucket = Bucket & { key: string };
type Query = { text: string; values: unknown[] };
type Consume = (kind: "pin" | "roster", ip: string, now?: number) => Promise<{ allowed: boolean; retryAfter: number }>;

// This is a serialized in-memory model of atomic database statements, not a
// PostgreSQL integration test. Importing the production Prisma client is blocked.
function storeFixture() {
  const buckets = new Map<string, Bucket>();
  const queries: Query[] = [];
  const cleanups: Query[] = [];
  let queue = Promise.resolve();
  let databaseError: Error | undefined;
  let consumeError: Error | undefined;
  let incompleteResult = false;
  let transformResults = (rows: ReturnedBucket[]) => rows;
  const query = (strings: TemplateStringsArray, values: unknown[]): Query => ({ text: strings.join("?"), values });
  const prisma = {
    async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      if (databaseError) throw databaseError;
      const statement = query(strings, values);
      cleanups.push(statement);
      assert.match(statement.text, /key LIKE 'magazzino:%'/);
      assert.match(statement.text, /FOR UPDATE SKIP LOCKED/);
      const [now, globalKey, ipKey, limit] = values as [Date, string, string, number];
      const expired = [...buckets].filter(([key, bucket]) => key.startsWith("magazzino:") && bucket.expires_at <= now && key !== globalKey && key !== ipKey)
        .sort(([a, one], [b, two]) => one.expires_at.getTime() - two.expires_at.getTime() || a.localeCompare(b))
        .slice(0, limit);
      for (const [key] of expired) buckets.delete(key);
      return expired.length;
    },
    $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const run = queue.then(() => {
        if (databaseError) throw databaseError;
        if (consumeError) throw consumeError;
        const statement = query(strings, values);
        queries.push(statement);
        assert.match(statement.text, /INSERT INTO mcp_rate_buckets/);
        assert.match(statement.text, /ORDER BY key\s+ON CONFLICT \(key\) DO UPDATE SET/);
        const [expiresAt, globalKey, ipKey, now, repeatedGlobalKey, globalCap, ipCap, repeatedNow] = values as [Date, string, string, Date, string, number, number, Date];
        assert.equal(globalKey, repeatedGlobalKey);
        assert.equal(now.getTime(), repeatedNow.getTime());
        const rows = [globalKey, ipKey].sort().map((key) => {
          const previous = buckets.get(key);
          const cap = key === globalKey ? globalCap : ipCap;
          const bucket = !previous || previous.expires_at <= now
            ? { count: 1, expires_at: new Date(expiresAt) }
            : { count: Math.min(previous.count + 1, cap), expires_at: previous.expires_at };
          buckets.set(key, bucket);
          return { key, ...bucket };
        });
        return incompleteResult ? rows.slice(0, 1) : transformResults(rows);
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  const require = createRequire(import.meta.url);
  const code = ts.transpileModule(readFileSync(new URL("../lib/magazzino/rate-limit.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const load = () => {
    const exports: { consumeMagazzinoRate?: Consume } = {};
    vm.runInNewContext(code, { exports, Date, require(name: string) {
      if (name === "@/lib/prisma") return { prisma };
      assert.equal(name, "node:crypto", "Unexpected dependency must not connect to the application database");
      return require(name);
    } });
    return exports.consumeMagazzinoRate!;
  };
  return {
    consume: load(), load, buckets, queries, cleanups,
    fail(error: Error) { databaseError = error; },
    failConsume(error: Error) { consumeError = error; },
    incomplete() { incompleteResult = true; },
    changeResults(transform: typeof transformResults) { transformResults = transform; },
  };
}

const ip = (index: number) => `192.0.2.${index}`;
const ipKey = (kind: string, address: string) => `magazzino:${kind}:ip:${createHash("sha256").update(address).digest("hex")}`;

for (const [kind, perIpLimit, globalLimit] of [["pin", 10, 60], ["roster", 30, 120]] as const) {
  test(`${kind}: exact IP limit, retry delay, expiry boundary and stable keys`, async () => {
    const fixture = storeFixture();
    const start = 10_123;
    for (let count = 0; count < perIpLimit; count++) {
      const result = await fixture.consume(kind, ip(1), start);
      assert.equal(result.allowed, true);
      assert.equal(result.retryAfter, 0);
    }
    assert.equal((await fixture.consume(kind, ip(1), start + 1234)).retryAfter, 59);
    assert.equal((await fixture.consume(kind, ip(1), start + 59_999)).allowed, false);
    const keys = [...fixture.buckets.keys()].sort();
    const reset = await fixture.consume(kind, ip(1), start + 60_000);
    assert.equal(reset.allowed, true);
    assert.deepEqual([...fixture.buckets.keys()].sort(), keys);
    assert.equal(fixture.buckets.get(ipKey(kind, ip(1)))?.count, 1);
    assert.equal(fixture.buckets.get(ipKey(kind, ip(1)))?.expires_at.getTime(), start + 120_000);
  });

  test(`${kind}: global limit spans IPs and uses the longest violated expiry`, async () => {
    const fixture = storeFixture();
    for (let count = 0; count < globalLimit; count++) {
      assert.equal((await fixture.consume(kind, ip(count + 1), 1000)).allowed, true);
    }
    const denied = await fixture.consume(kind, ip(globalLimit + 1), 2000);
    assert.equal(denied.allowed, false);
    assert.equal(denied.retryAfter, 59);
    // The IP window starts later than the global window; both can be exceeded.
    for (let count = 0; count < perIpLimit; count++) await fixture.consume(kind, ip(globalLimit + 1), 3000);
    assert.equal((await fixture.consume(kind, ip(globalLimit + 1), 4000)).retryAfter, 58);
    assert.equal(fixture.buckets.get(`magazzino:${kind}:global`)?.count, globalLimit + 1);
    assert.equal(fixture.buckets.get(ipKey(kind, ip(globalLimit + 1)))?.count, perIpLimit + 1);
  });

  test(`${kind}: concurrent callers share the atomic IP and global quotas`, async () => {
    const fixture = storeFixture();
    const anotherProcess = fixture.load();
    const sameIp = await Promise.all(Array.from({ length: perIpLimit * 3 }, (_, index) =>
      (index % 2 ? fixture.consume : anotherProcess)(kind, ip(1), 10_000)));
    assert.equal(sameIp.filter((result) => result.allowed).length, perIpLimit);
    const fresh = storeFixture();
    const secondCaller = fresh.load();
    const manyIps = await Promise.all(Array.from({ length: globalLimit * 2 }, (_, index) =>
      (index % 2 ? fresh.consume : secondCaller)(kind, ip(index % 250 + 1), 20_000)));
    assert.equal(manyIps.filter((result) => result.allowed).length, globalLimit);
    assert.equal(fresh.queries.length, globalLimit * 2, "Each attempt uses one atomic two-bucket consume statement");
  });
}

test("PIN and roster quotas are independent, with only hashed IPs in stable bucket keys", async () => {
  const fixture = storeFixture();
  const address = "2001:db8::1234";
  for (let count = 0; count < 11; count++) await fixture.consume("pin", address, 5000);
  assert.equal((await fixture.consume("roster", address, 5000)).allowed, true);
  assert.equal(fixture.buckets.size, 4);
  for (const key of fixture.buckets.keys()) {
    assert.match(key, /^magazzino:(pin|roster):(global|ip:[a-f0-9]{64})$/);
    assert.equal(key.includes(address), false);
  }
});

test("cleanup removes at most 32 expired Magazzino rows and preserves other namespaces", async () => {
  const fixture = storeFixture();
  for (let index = 0; index < 40; index++) fixture.buckets.set(`magazzino:pin:old-${index}`, { count: 1, expires_at: new Date(999) });
  fixture.buckets.set("magazzino:roster:active", { count: 1, expires_at: new Date(5000) });
  fixture.buckets.set("mcp:expired", { count: 1, expires_at: new Date(999) });
  await fixture.consume("pin", ip(1), 1000);
  assert.equal([...fixture.buckets.keys()].filter((key) => key.startsWith("magazzino:pin:old-")).length, 8);
  assert.ok(fixture.buckets.has("magazzino:roster:active"));
  assert.ok(fixture.buckets.has("mcp:expired"));
  assert.equal(fixture.cleanups.length, 1);
});

test("database failures and incomplete atomic results propagate instead of allowing requests", async () => {
  const failed = storeFixture();
  const error = new Error("database unavailable");
  failed.fail(error);
  await assert.rejects(failed.consume("pin", ip(1), 1000), (cause) => cause === error);
  assert.equal(failed.queries.length, 0);
  const failedConsume = storeFixture();
  failedConsume.failConsume(error);
  await assert.rejects(failedConsume.consume("pin", ip(1), 1000), (cause) => cause === error);
  assert.equal(failedConsume.cleanups.length, 1);
  const incomplete = storeFixture();
  incomplete.incomplete();
  await assert.rejects(incomplete.consume("roster", ip(1), 1000), /Incomplete Magazzino rate-limit result/);
});

test("invalid counts or expiries fail closed and RETURNING row order is irrelevant", async () => {
  for (const invalid of [{ count: NaN }, { count: 0 }, { expires_at: new Date(NaN) }, { expires_at: new Date(1000) }]) {
    const fixture = storeFixture();
    fixture.changeResults((rows) => [{ ...rows[0], ...invalid }, rows[1]]);
    await assert.rejects(fixture.consume("pin", ip(1), 1000), /Invalid Magazzino rate-limit result/);
  }
  const reversed = storeFixture();
  reversed.changeResults((rows) => rows.reverse());
  for (let count = 0; count < 10; count++) assert.equal((await reversed.consume("pin", ip(1), 1000)).allowed, true);
  assert.equal((await reversed.consume("pin", ip(1), 1001)).allowed, false);
});

test("invalid internal input fails before any database statement", async () => {
  const fixture = storeFixture();
  for (const [kind, address, now] of [["invalid", ip(1), 1000], ["pin", " ", 1000], ["pin", ip(1), NaN]] as const) {
    await assert.rejects(fixture.consume(kind as "pin", address, now), /Invalid Magazzino rate-limit input/);
  }
  assert.equal(fixture.cleanups.length, 0);
  assert.equal(fixture.queries.length, 0);
});
