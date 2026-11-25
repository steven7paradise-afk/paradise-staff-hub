import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import bcrypt from "bcryptjs";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { POST } from "../app/api/magazzino/verifica-pin/route";
import { GET } from "../app/api/magazzino/dipendenti/route";
import { authorizeMagazzino, readMagazzinoPinBody } from "../lib/magazzino/access";
import { pinLookup } from "../lib/pin";
import { prisma } from "../lib/prisma";

function fixture(t: TestContext) {
  const variables = ["MAGAZZINO_API_KEY", "MAGAZZINO_TRUST_PROXY", "MAGAZZINO_ALLOWED_IPS"];
  const before = variables.map(name => process.env[name]);
  const key = randomBytes(48).toString("base64url");
  process.env.MAGAZZINO_API_KEY = key;
  process.env.MAGAZZINO_TRUST_PROXY = "true";
  process.env.MAGAZZINO_ALLOWED_IPS = "192.0.2.10";
  t.after(() => variables.forEach((name, index) => {
    if (before[index] === undefined) delete process.env[name];
    else process.env[name] = before[index];
  }));
  return (path: string, options: RequestInit = {}) => new Request(`https://staff.example.test/api/magazzino/${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${key}`,
      "x-forwarded-proto": "https",
      "x-forwarded-for": "192.0.2.10",
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(options.headers)),
    },
  });
}

test("both standalone routes deny absent/wrong credentials without redirects", async t => {
  const request = fixture(t);
  for (const authorization of ["", "Bearer invalid"]) {
    const verify = await POST(request("verifica-pin", { method: "POST", headers: { authorization } }));
    const roster = await GET(request("dipendenti", { headers: { authorization } }));
    for (const response of [verify, roster]) {
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { ok: false });
      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
});

test("TLS, missing ingress identity, query credentials and spoofed leftmost IP fail closed", t => {
  const request = fixture(t);
  const cases: [HeadersInit, number][] = [
    [{ "x-forwarded-proto": "http" }, 403],
    [{ "x-forwarded-proto": "https,http" }, 403],
    [{ "x-forwarded-for": "" }, 503],
    [{ "x-forwarded-for": "fe80::1%eth0" }, 503],
    [{ "x-forwarded-for": "192.0.2.10, 198.51.100.7" }, 403],
  ];
  for (const [headers, expected] of cases) {
    const denied = authorizeMagazzino(request("dipendenti", { headers }));
    assert.ok(denied instanceof Response);
    assert.equal(denied.status, expected);
  }
  const query = authorizeMagazzino(request("verifica-pin?unexpected=1"));
  assert.ok(query instanceof Response);
  assert.equal(query.status, 400);
  delete process.env.MAGAZZINO_API_KEY;
  const unset = authorizeMagazzino(request("dipendenti"));
  assert.ok(unset instanceof Response);
  assert.equal(unset.status, 503);
});

test("body reader rejects oversized chunked data, malformed JSON, extra fields and slow bodies", async t => {
  const request = fixture(t);
  for (const body of ["{" , JSON.stringify({ pin: null, extra: true }), "x".repeat(257)]) {
    await assert.rejects(readMagazzinoPinBody(request("verifica-pin", { method: "POST", body })));
  }
  const oversized = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode("x".repeat(200)));
    controller.enqueue(new TextEncoder().encode("x".repeat(100)));
    controller.close();
  } });
  await assert.rejects(readMagazzinoPinBody(request("verifica-pin", { method: "POST", body: oversized, duplex: "half" } as RequestInit)));
  const slow = new ReadableStream<Uint8Array>({ start() {} });
  await assert.rejects(readMagazzinoPinBody(request("verifica-pin", { method: "POST", body: slow, duplex: "half" } as RequestInit), 10));
});

test("routes return minimal worker data, reject an incorrect PIN, then enforce 429", async t => {
  const request = fixture(t);
  const pin = String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, "0");
  const incorrectPin = String((Number(pin) + 1) % 1_000_000).padStart(6, "0");
  const worker = { id: "fixture-worker", name: "Persona Fittizia", active: true, employee_status: "Attivo", pin_hash: bcrypt.hashSync(pin, 4), pin_lookup: pinLookup(pin) };
  const counts = { pin: 0, roster: 0 };
  const original = { query: prisma.$queryRaw, execute: prisma.$executeRaw, workers: prisma.user.findMany, update: prisma.user.update };
  t.after(() => {
    prisma.$queryRaw = original.query;
    prisma.$executeRaw = original.execute;
    prisma.user.findMany = original.workers;
    prisma.user.update = original.update;
  });
  prisma.$queryRaw = (async (_sql: TemplateStringsArray, ...values: unknown[]) => {
    const kind = values.includes("magazzino:roster:global") ? "roster" : "pin";
    const count = ++counts[kind];
    return [
      { count, expires_at: new Date(Date.now() + 60_000), key: `magazzino:${kind}:global` },
      { count, expires_at: new Date(Date.now() + 60_000), key: `magazzino:${kind}:ip:${createHash("sha256").update("192.0.2.10").digest("hex")}` },
    ];
  }) as typeof original.query;
  prisma.$executeRaw = (async () => 0) as typeof original.execute;
  prisma.user.findMany = (async () => [worker]) as unknown as typeof original.workers;
  prisma.user.update = (() => { throw new Error("must_not_write"); }) as typeof original.update;
  const verified = await POST(request("verifica-pin", { method: "POST", body: JSON.stringify({ pin }) }));
  assert.equal(verified.status, 200);
  assert.deepEqual(await verified.json(), { ok: true, dipendente_id: worker.id, nome: worker.name, attivo: true });
  const roster = await GET(request("dipendenti"));
  assert.equal(roster.status, 200);
  assert.deepEqual(await roster.json(), [{ dipendente_id: worker.id, nome: worker.name, attivo: true }]);
  for (let count = 0; count < 9; count++) {
    const invalid = await POST(request("verifica-pin", { method: "POST", body: JSON.stringify({ pin: incorrectPin }) }));
    assert.equal(invalid.status, 200);
    assert.deepEqual(await invalid.json(), { ok: false });
  }
  const blocked = await POST(request("verifica-pin", { method: "POST", body: JSON.stringify({ pin }) }));
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});

test("database/limiter failures disclose no exception or request input and do not log", async t => {
  const request = fixture(t);
  const logs = [t.mock.method(console, "log", () => {}), t.mock.method(console, "error", () => {}), t.mock.method(console, "warn", () => {})];
  const originalQuery = prisma.$queryRaw;
  const originalExecute = prisma.$executeRaw;
  t.after(() => { prisma.$queryRaw = originalQuery; prisma.$executeRaw = originalExecute; });
  prisma.$queryRaw = (async () => { throw new Error("private database detail"); }) as typeof originalQuery;
  prisma.$executeRaw = (async () => { throw new Error("private database detail"); }) as typeof originalExecute;
  for (const response of [await GET(request("dipendenti")), await POST(request("verifica-pin", { method: "POST", body: "{" }))]) {
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false });
  }
  assert.ok(logs.every(mock => mock.mock.callCount() === 0));
});

test("proxy excludes only the exact two API paths, preserving existing inventory protection", () => {
  // Avoid initializing Auth.js and unrelated production integrations in this test.
  const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  const matcher = /matcher: \[(".*")\]/.exec(source);
  assert.ok(matcher);
  const config = { matcher: [JSON.parse(matcher[1])] };
  for (const path of ["verifica-pin", "dipendenti", "dipendenti/"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `/api/magazzino/${path}` }), false);
  }
  for (const path of ["/api/magazzino", "/api/magazzino/dipendenti-extra", "/api/magazzino/dipendenti/private", "/api/magazzino/verifica-pin-extra"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), true);
  }
});
