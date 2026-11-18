import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { NextRequest } from "next/server";
import { appointmentPcReceptionCookieName, signAppointmentPcReception } from "../lib/appointment-pc-reception-session";

const SECRET = "synthetic-order-resolution-secret";
const SITE = "fixture-repubblica";
const RECEPTION = "fixture-reception";
const WORKER_DEVICE = "fixture-worker-device";
const RECEPTION_DEVICE = "fixture-reception-device";

type FixtureUser = {
  id: string; name: string; role: string; mansione: string; sede_id: string;
  active: boolean; employee_status: string; photo_url: null; email: string;
  location: { id: string; name: string; active: boolean };
};

async function routeFixture() {
  const location = { id: SITE, name: "Salone Repubblica", active: true };
  const makeUser = (id: string, role = "DIPENDENTE", site = location): FixtureUser => ({
    id, name: "Operatore demo", role, mansione: id === RECEPTION ? "Receptionist" : "Parrucchiera",
    sede_id: site.id, active: true, employee_status: "Attivo", photo_url: null,
    email: "fixture@example.test", location: site,
  });
  const users = new Map([
    ["fixture-admin", makeUser("fixture-admin", "ADMIN")],
    ["fixture-personal", makeUser("fixture-personal")],
    ["fixture-corso", makeUser("fixture-corso", "DIPENDENTE", { id: "fixture-legacy", name: "Salone Buenos Aires", active: true })],
    [RECEPTION, makeUser(RECEPTION)],
    ["fixture-remote-worker", makeUser("fixture-remote-worker")],
  ]);
  const fixture = {
    session: null as { user: { id: string; role: string } } | null,
    users,
    rolePermissions: null as Record<string, { view: string[]; edit: string[] }> | null,
    clockedIn: true,
    lookupResult: { id: "fixture-order", answers: { order_items: "Acquisto extension" } } as { id: string; answers: Record<string, string> } | null,
    lookupCalls: [] as Array<{ reference: string; operationalLocationId: string }>,
    lookupFails: false,
    remoteSessions: {} as Record<string, { active: boolean; controllerId: string; workerId: string; expiresAt: string }>,
    prisma: {
      location: { findUnique: async () => location, findMany: async () => [location] },
      setting: { findUnique: async ({ where }: { where: { key: string } }) => {
        if (where.key === "role_permissions") return { value: fixture.rolePermissions };
        if (where.key === "mansioni_permissions") return null;
        if (where.key === "appointments_remote_sessions") return { value: fixture.remoteSessions };
        if (where.key !== "appointments_authorized_pcs") throw new Error("Unexpected settings lookup");
        return { value: [WORKER_DEVICE, RECEPTION_DEVICE].map((token, index) => ({
          code: `fixture-device-${index}`, name: "Fixture PC", locationId: SITE,
          accessMode: index === 0 ? "worker" : "reception",
          accessTokenHash: createHash("sha256").update(token).digest("hex"),
          archivedAt: null, activatedAt: "2026-11-18T08:00:00Z",
        })) };
      } },
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
        findFirst: async ({ where }: { where: { id: string } }) => {
          const user = users.get(where.id);
          return user?.active ? {
            ...user,
            attendance_logs: fixture.clockedIn ? [{ type: "ENTRATA", timestamp: new Date(Date.now() - 60_000) }] : [],
          } : null;
        },
      },
    },
  };
  const mocks: Record<string, string> = {
    "@/lib/auth": "export const auth = async () => fixture.session;",
    prisma: "export const prisma = fixture.prisma;",
    "@/lib/order-workspace-store": `export const findOrderWorkspaceReference = async (reference, operationalLocationId) => {
      fixture.lookupCalls.push({ reference, operationalLocationId });
      if (fixture.lookupFails) throw new Error('Synthetic lookup failure');
      return fixture.lookupResult;
    };`,
  };
  const result = await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    entryPoints: ["app/api/orders/resolve/route.ts"],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    define: { "process.env.AUTH_SECRET": JSON.stringify(SECRET), "process.env.NEXTAUTH_SECRET": "undefined" },
    plugins: [{ name: "order-resolve-fixture", setup(bundle) {
      bundle.onResolve({ filter: /^(?:@\/lib\/(?:auth|prisma|order-workspace-store)|\.\/prisma)$/ }, ({ path }) => ({
        path: path.endsWith("/prisma") ? "prisma" : path, namespace: "fixture",
      }));
      bundle.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js" }));
    } }],
  });
  const route = { exports: {} as { GET: (request: NextRequest) => Promise<Response> } };
  new Function("require", "module", "exports", "fixture", result.outputFiles[0].text)(
    createRequire(import.meta.url), route, route.exports, fixture,
  );
  return {
    fixture,
    async request(query: Record<string, string> = { reference: "#25989" }, cookies: Record<string, string> = {}) {
      fixture.lookupCalls = [];
      const response = await route.exports.GET(new NextRequest(`https://staff.example.test/api/orders/resolve?${new URLSearchParams(query)}`, {
        headers: { cookie: Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ") },
      }));
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      return response;
    },
  };
}

test("anonymous requests and a forged worker cookie cannot search orders", async () => {
  const { fixture, request } = await routeFixture();
  const cookieCases: Array<Record<string, string>> = [{}, { appointments_pc_worker: "fixture-admin" }, { appointments_pc_token: "invalid-device" }];
  for (const cookies of cookieCases) {
    assert.equal((await request(undefined, cookies)).status, 401);
    assert.equal(fixture.lookupCalls.length, 0);
  }
});

test("personal access retains the existing Buenos Aires workstation restriction", async () => {
  const { fixture, request } = await routeFixture();
  fixture.session = { user: { id: "fixture-corso", role: "DIPENDENTE" } };
  assert.equal((await request()).status, 403);
  assert.equal(fixture.lookupCalls.length, 0);
  fixture.session = { user: { id: "fixture-personal", role: "DIPENDENTE" } };
  assert.deepEqual(await (await request()).json(), { href: "/orders?ordine=fixture-order" });
  assert.deepEqual(fixture.lookupCalls, [{ reference: "#25989", operationalLocationId: "" }]);
});

test("worker-purpose devices retain salon-scoped read access without a daily Reception grant", async () => {
  const { fixture, request } = await routeFixture();
  fixture.rolePermissions = { RESPONSABILE: { view: ["/dashboard"], edit: [] } };
  const response = await request({ reference: "  https://staff.example.test/o/25989  ", remoteTarget: "unverified-target" }, { appointments_pc_token: WORKER_DEVICE });
  assert.deepEqual(await response.json(), { href: "/orders?ordine=fixture-order" });
  assert.deepEqual(fixture.lookupCalls, [{ reference: "https://staff.example.test/o/25989", operationalLocationId: SITE }]);
});

test("a custom Ordini view denial blocks a personal session before record lookup", async () => {
  const { fixture, request } = await routeFixture();
  fixture.session = { user: { id: "fixture-personal", role: "DIPENDENTE" } };
  fixture.rolePermissions = { DIPENDENTE: { view: ["/dashboard"], edit: [] } };
  assert.equal((await request()).status, 403);
  assert.equal(fixture.lookupCalls.length, 0);
  fixture.rolePermissions.DIPENDENTE.view.push("/orders");
  assert.equal((await request()).status, 200);
  assert.equal(fixture.lookupCalls.length, 1);
});

test("an inactive or missing personal user cannot resolve an order with an existing session", async () => {
  const { fixture, request } = await routeFixture();
  fixture.session = { user: { id: "fixture-personal", role: "DIPENDENTE" } };
  fixture.users.get("fixture-personal")!.active = false;
  assert.equal((await request()).status, 403);
  assert.equal(fixture.lookupCalls.length, 0);
  fixture.users.delete("fixture-personal");
  assert.equal((await request()).status, 403);
  assert.equal(fixture.lookupCalls.length, 0);
});

test("Reception requires a valid daily personal grant and an active shift before lookup", async () => {
  const { fixture, request } = await routeFixture();
  const device = { appointments_pc_token: RECEPTION_DEVICE, appointments_pc_worker: "fixture-admin" };
  const expired = signAppointmentPcReception(RECEPTION, SITE, RECEPTION_DEVICE, SECRET, Date.now() - 25 * 60 * 60_000).token;
  for (const token of [undefined, "forged-grant", expired]) {
    assert.equal((await request(undefined, { ...device, ...(token ? { [appointmentPcReceptionCookieName]: token } : {}) })).status, 403);
    assert.equal(fixture.lookupCalls.length, 0);
  }
  const grant = signAppointmentPcReception(RECEPTION, SITE, RECEPTION_DEVICE, SECRET).token;
  fixture.clockedIn = false;
  assert.equal((await request(undefined, { ...device, [appointmentPcReceptionCookieName]: grant })).status, 403);
  assert.equal(fixture.lookupCalls.length, 0);
  fixture.clockedIn = true;
  fixture.lookupResult = { id: "fixture-conversion", answers: { order_items: "Conversione capelli" } };
  const response = await request(undefined, { ...device, [appointmentPcReceptionCookieName]: grant });
  assert.deepEqual(await response.json(), { href: "/conversioni?ordine=fixture-conversion" });
  assert.deepEqual(fixture.lookupCalls, [{ reference: "#25989", operationalLocationId: SITE }]);
});

test("foreign or absent records share a scoped 404 without returning record metadata", async () => {
  const { fixture, request } = await routeFixture();
  fixture.lookupResult = null;
  for (const reference of ["foreign-order", "absent-order"]) {
    const response = await request({ reference }, { appointments_pc_token: WORKER_DEVICE });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Ordine non trovato." });
    assert.deepEqual(fixture.lookupCalls, [{ reference, operationalLocationId: SITE }]);
  }
});

test("only an active remote session owned by the administrator is forwarded", async () => {
  const { fixture, request } = await routeFixture();
  fixture.session = { user: { id: "fixture-admin", role: "ADMIN" } };
  fixture.remoteSessions.target = {
    active: true, controllerId: "fixture-admin", workerId: "fixture-remote-worker",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const response = await request({ reference: "25989", remoteTarget: "target", next: "https://invalid.example.test" });
  assert.deepEqual(await response.json(), { href: "/orders?ordine=fixture-order&remoteTarget=target" });
  assert.deepEqual(fixture.lookupCalls, [{ reference: "25989", operationalLocationId: SITE }]);
  const valid = { ...fixture.remoteSessions.target };
  for (const invalid of [
    { ...valid, controllerId: "different-admin" },
    { ...valid, active: false },
    { ...valid, expiresAt: new Date(Date.now() - 60_000).toISOString() },
  ]) {
    fixture.remoteSessions.target = invalid;
    assert.deepEqual(await (await request({ reference: "25989", remoteTarget: "target" })).json(), { href: "/orders?ordine=fixture-order" });
    assert.deepEqual(fixture.lookupCalls, [{ reference: "25989", operationalLocationId: "" }]);
  }
});

test("administrator sessions retain page precedence over a leftover Reception device cookie", async () => {
  const { fixture, request } = await routeFixture();
  fixture.session = { user: { id: "fixture-admin", role: "ADMIN" } };
  assert.equal((await request({})).status, 400);
  assert.equal(fixture.lookupCalls.length, 0);
  assert.equal((await request(undefined, { appointments_pc_token: RECEPTION_DEVICE })).status, 200);
  assert.deepEqual(fixture.lookupCalls, [{ reference: "#25989", operationalLocationId: "" }]);
});

test("invalid input and lookup failures return bounded errors without record data", async () => {
  const { fixture, request } = await routeFixture();
  fixture.session = { user: { id: "fixture-admin", role: "ADMIN" } };
  for (const reference of ["", " ", "x".repeat(2049)]) {
    assert.equal((await request({ reference })).status, 400);
    assert.equal(fixture.lookupCalls.length, 0);
  }
  fixture.lookupFails = true;
  const response = await request();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Impossibile cercare l’ordine. Riprova." });
});
