import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { NextRequest } from "next/server";
import { appointmentPcReceptionCookieName, signAppointmentPcReception } from "../lib/appointment-pc-reception-session";

const SECRET = "synthetic-reception-route-secret";
const USER = "fixture-receptionist";
const LOCATION = "fixture-repubblica";
const RECEPTION_DEVICE = "fixture-reception-device";
const WORKER_DEVICE = "fixture-worker-device";

async function routeFixture(entryPoint: string) {
  const location = { id: LOCATION, name: "Salone Repubblica", active: true };
  const fixture = {
    request: null as NextRequest | null,
    clockedIn: true,
    privateReads: 0,
    providerReads: 0,
    prisma: {
      location: { findUnique: async () => location, findMany: async () => [location] },
      setting: {
        findUnique: async ({ where }: { where: { key: string } }) => where.key === "appointments_authorized_pcs"
          ? { value: [RECEPTION_DEVICE, WORKER_DEVICE].map((token, index) => ({
            code: `fixture-device-${index}`, name: "Fixture device", locationId: LOCATION,
            accessMode: index === 0 ? "reception" : "worker",
            accessTokenHash: createHash("sha256").update(token).digest("hex"),
            archivedAt: null, activatedAt: "2026-11-18T08:00:00.000Z",
          })) } : null,
        findMany: async () => { fixture.privateReads++; return []; },
      },
      user: {
        findFirst: async ({ where }: { where: { id?: string } }) => {
          assert.equal(where.id, USER, "Reception must resolve the signed personal identity");
          return {
            id: USER, name: "Reception fixture", email: "fixture@example.test", photo_url: null,
            role: "DIPENDENTE", mansione: "Receptionist", sede_id: LOCATION,
            attendance_logs: fixture.clockedIn ? [{ type: "ENTRATA", timestamp: new Date(Date.now() - 60_000) }] : [],
          };
        },
        findMany: async () => { fixture.privateReads++; return []; },
      },
      serviceForm: { findMany: async () => { fixture.privateReads++; return []; } },
      attendanceLog: { findMany: async () => { fixture.privateReads++; return []; } },
    },
  };
  const mocks: Record<string, string> = {
    "@/lib/auth": "export const auth = async () => null;",
    "next/headers": "export const cookies = async () => fixture.request.cookies; export const headers = async () => fixture.request.headers;",
    prisma: "export const prisma = fixture.prisma;",
    "@/lib/tablet-auth": "export const authorizedTablet = async () => null; export const requestIp = () => null; export const tabletCookieName = 'fixture_tablet'; export const tabletDeviceCookieName = 'fixture_tablet_device';",
    "@/lib/cowlendar": "export const getCowlendarBookingsForRange = async () => { fixture.providerReads++; return []; };",
    "@/lib/shopify": "export const getShopifyOrderIdentity = async () => { throw new Error('Unexpected Shopify call'); };",
  };
  const result = await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)), entryPoints: [entryPoint],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    define: {
      "process.env.AUTH_SECRET": JSON.stringify(SECRET),
      "process.env.NEXTAUTH_SECRET": "undefined", "process.env.OPENAI_API_KEY": "undefined",
    },
    plugins: [{ name: "reception-api-fixture", setup(bundle) {
      bundle.onResolve({ filter: /^(?:@\/lib\/(?:auth|prisma|tablet-auth|cowlendar|shopify)|next\/headers|\.\/prisma)$/ }, ({ path }) => ({
        path: path.endsWith("/prisma") ? "prisma" : path, namespace: "fixture",
      }));
      bundle.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js" }));
    } }],
  });
  const route = { exports: {} as Record<string, (request: NextRequest) => Promise<Response>> };
  new Function("require", "module", "exports", "fixture", result.outputFiles[0].text)(
    createRequire(import.meta.url), route, route.exports, fixture,
  );
  return {
    fixture,
    async request(method: "GET" | "POST", cookies: Record<string, string>) {
      fixture.privateReads = 0;
      fixture.providerReads = 0;
      fixture.request = new NextRequest("https://staff.example.test/api/fixture", {
        method, headers: { cookie: Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; "), "content-type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify({ note: "Nota di prova" }) } : {}),
      });
      return route.exports[method](fixture.request);
    },
  };
}

for (const [label, entryPoint, method] of [
  ["client analytics", "app/api/client-control/analytics/route.ts", "GET"],
  ["note polishing", "app/api/client-control/polish-note/route.ts", "POST"],
  ["in-progress appointments", "app/api/appointments/in-progress/route.ts", "GET"],
] as const) {
  test(`${label} requires a current in-shift Reception grant without changing worker access`, async () => {
    const { fixture, request } = await routeFixture(entryPoint);
    const device = { appointments_pc_token: RECEPTION_DEVICE };
    const daily = signAppointmentPcReception(USER, LOCATION, RECEPTION_DEVICE, SECRET).token;
    const expired = signAppointmentPcReception(USER, LOCATION, RECEPTION_DEVICE, SECRET, Date.now() - 25 * 60 * 60_000).token;
    for (const [reason, cookies] of [
      ["logged out", device],
      ["forged selected administrator", { ...device, appointments_pc_worker: "forged-admin" }],
      ["previous-day grant", { ...device, [appointmentPcReceptionCookieName]: expired }],
    ] as const) {
      assert.equal((await request(method, cookies)).status, 401, reason);
      assert.equal(fixture.privateReads, 0, `${reason}: customer data must not be read`);
      assert.equal(fixture.providerReads, 0, reason);
    }
    fixture.clockedIn = false;
    assert.equal((await request(method, { ...device, [appointmentPcReceptionCookieName]: daily })).status, 401, "OUT is arrival-only");
    assert.equal(fixture.privateReads, 0);
    fixture.clockedIn = true;
    assert.equal((await request(method, { ...device, [appointmentPcReceptionCookieName]: daily, appointments_pc_worker: "forged-admin" })).status, 200, "the signed personal receptionist can work in shift");
    assert.equal((await request(method, { appointments_pc_token: WORKER_DEVICE })).status, 200, "existing worker-purpose access is unchanged");
  });
}

test("native feed rejects Reception before reading bookings, including after a successful daily PIN", async () => {
  const { fixture, request } = await routeFixture("app/api/appointments/native-feed/route.ts");
  const daily = signAppointmentPcReception(USER, LOCATION, RECEPTION_DEVICE, SECRET).token;
  const cookieCases: Array<Record<string, string>> = [
    { appointments_pc_token: RECEPTION_DEVICE },
    { appointments_pc_token: RECEPTION_DEVICE, [appointmentPcReceptionCookieName]: daily, appointments_pc_worker: "forged-admin" },
  ];
  for (const cookies of cookieCases) {
    assert.equal((await request("GET", cookies)).status, 403);
    assert.equal(fixture.privateReads, 0);
    assert.equal(fixture.providerReads, 0);
  }
  assert.equal((await request("GET", { appointments_pc_token: WORKER_DEVICE })).status, 200);
  assert.equal(fixture.providerReads, 1, "worker native feed retains its existing provider read");
});
