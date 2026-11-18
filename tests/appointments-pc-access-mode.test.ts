import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as salonUrls from "../lib/appointment-salon-url";
import type { AuthorizedPC } from "../lib/appointments-pc-auth";

function loadModule(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    console,
    require: (name: string) => dependencies[name] ?? {},
  });
  return exports;
}

function authorizationFixture(initial: AuthorizedPC[] = [], location = { active: true, name: "Salone Repubblica" }) {
  let records = structuredClone(initial);
  let writes = 0;
  let locationReads = 0;
  const prisma = {
    setting: {
      findUnique: async () => ({ key: "appointments_authorized_pcs", value: structuredClone(records) }),
      upsert: async ({ update }: { update: { value: AuthorizedPC[] } }) => {
        records = structuredClone(update.value);
        writes++;
      },
    },
    location: { findUnique: async () => { locationReads++; return location; } },
  };
  const authorization = loadModule("lib/appointments-pc-auth.ts", {
    "node:crypto": crypto,
    "./prisma": { prisma },
    "./appointment-salon-url": salonUrls,
  }) as unknown as typeof import("../lib/appointments-pc-auth");
  return { authorization, records: () => records, writes: () => writes, locationReads: () => locationReads };
}

function legacyPc(token: string): AuthorizedPC {
  return {
    code: "legacy-worker-code", name: "PC esistente", locationId: "salon-test",
    createdAt: "2026-11-18T08:00:00Z", activatedAt: "2026-11-18T08:01:00Z",
    accessTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    registeredIp: null, archivedAt: null,
  };
}

test("legacy links and omitted purposes remain worker devices without changing existing records", async () => {
  const existing = legacyPc("legacy-token");
  const fixture = authorizationFixture([existing]);
  assert.equal((await fixture.authorization.checkPCAuthorization("legacy-token"))?.accessMode, "worker");
  const code = await fixture.authorization.generateOneTimeCode("salon-test", "Nuovo PC");
  assert.equal(fixture.writes(), 1);
  assert.equal(fixture.locationReads(), 0);
  assert.deepEqual(fixture.records()[0], existing);
  assert.equal(fixture.records()[1].code, code);
  assert.equal(fixture.records()[1].accessMode, "worker");
  assert.equal(fixture.records()[1].activatedAt, null);
  assert.equal(fixture.records()[1].accessTokenHash, null);
});

test("reception purpose is persisted and returned by device authorization", async () => {
  const fixture = authorizationFixture([{ ...legacyPc("reception-token"), accessMode: "reception" }]);
  assert.equal((await fixture.authorization.checkPCAuthorization("reception-token"))?.accessMode, "reception");
  await fixture.authorization.generateOneTimeCode("salon-test", "Reception", "reception");
  assert.equal(fixture.locationReads(), 1);
  assert.equal(fixture.records()[1].accessMode, "reception");
});

test("generation rejects unsupported purposes and reception outside active Repubblica before writing", async () => {
  const invalid = authorizationFixture();
  await assert.rejects(invalid.authorization.generateOneTimeCode("salon-test", "PC", "other" as "worker"), /Lavoratori o Reception/);
  assert.equal(invalid.writes(), 0);
  for (const location of [
    { active: false, name: "Salone Repubblica" },
    { active: true, name: "Corso Buenos Aires" },
    { active: true, name: "Salone Duomo" },
  ]) {
    const fixture = authorizationFixture([], location);
    await assert.rejects(fixture.authorization.generateOneTimeCode("salon-test", "Reception", "reception"), /solo per Repubblica attiva/);
    assert.equal(fixture.writes(), 0);
  }
});

function generationFixture(options: { salon?: string | null; role?: string | null } = {}) {
  const generated: unknown[][] = [];
  const role = options.role === undefined ? "ADMIN" : options.role;
  const route = loadModule("app/api/appointments/pc/generate/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/auth": { auth: async () => role ? { user: { id: "admin-test" } } : null },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ role }) } } },
    "@/lib/appointment-salon-url": salonUrls,
    "@/lib/appointments-pc-auth": {
      appointmentSalonForPC: async () => options.salon === undefined ? "repubblica" : options.salon,
      generateOneTimeCode: async (...args: unknown[]) => { generated.push(args); return "test-code"; },
    },
  }) as unknown as typeof import("../app/api/appointments/pc/generate/route");
  const request = (extra: Record<string, unknown> = {}) => new Request("https://staff.example.test/api/appointments/pc/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: "salon-test", name: "PC test", ...extra }),
  }) as Parameters<typeof route.POST>[0];
  return { route, request, generated };
}

test("generation API defaults old clients to worker and forwards a valid reception purpose", async () => {
  const fixture = generationFixture();
  const worker = await fixture.route.POST(fixture.request());
  assert.equal(worker.status, 200);
  assert.equal((await worker.json()).accessMode, "worker");
  const reception = await fixture.route.POST(fixture.request({ accessMode: "reception" }));
  assert.equal(reception.status, 200);
  assert.equal((await reception.json()).accessMode, "reception");
  assert.deepEqual(fixture.generated, [
    ["salon-test", "PC test", "worker"],
    ["salon-test", "PC test", "reception"],
  ]);
});

test("generation API rejects invalid purposes, unavailable reception salons and unchanged unauthorized roles", async () => {
  for (const accessMode of [null, "other", false, 1, {}]) {
    const fixture = generationFixture();
    assert.equal((await fixture.route.POST(fixture.request({ accessMode }))).status, 400);
    assert.equal(fixture.generated.length, 0);
  }
  for (const salon of [null, "buenos-aires", "duomo"]) {
    const fixture = generationFixture({ salon });
    assert.equal((await fixture.route.POST(fixture.request({ accessMode: "reception" }))).status, 400);
    assert.equal(fixture.generated.length, 0);
  }
  for (const [role, status] of [[null, 401], ["DIPENDENTE", 403]] as const) {
    const fixture = generationFixture({ role });
    assert.equal((await fixture.route.POST(fixture.request({ accessMode: "reception" }))).status, status);
    assert.equal(fixture.generated.length, 0);
  }
});
