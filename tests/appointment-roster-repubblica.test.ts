import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { NextRequest } from "next/server";
import { repubblicaAppointmentRosterScope } from "../lib/appointment-staff-access";
import { FORMER_EMPLOYEE_STATUS } from "../lib/former-employee";

type WorkerFilter = {
  id?: string;
  name?: { equals: string };
  sede_id?: { in: string[] } | null;
};

type WorkerQuery = {
  where: { active: boolean; employee_status?: { not: string }; OR?: WorkerFilter[] };
};

type RosterWorker = {
  id: string;
  name: string;
  status: string;
  alwaysActive: boolean;
  clockedInAt: string | null;
};

test("Repubblica agendas include their always-available owner without a clock-in", async () => {
  const salonId = "test-repubblica";
  const officeId = "test-office";
  const ownerId = repubblicaAppointmentRosterScope([salonId]).find((filter) => filter.id)?.id;
  assert.ok(ownerId);
  const salon = { id: salonId, name: "Salone Repubblica", active: true };
  const office = { id: officeId, name: "Ufficio Paradise", active: true };
  const clockIn = { type: "ENTRATA", timestamp: "2026-11-14T08:00:00.000Z", location_id: salonId };
  const base = { employee_status: "Attivo", active: true, photo_url: null, attendance_logs: [] as typeof clockIn[] };
  const localWorker = { ...base, id: "test-local", name: "Operatrice locale", sede_id: salonId, location: salon };
  const pcToken = "test-roster-pc";
  const fixture = {
    session: { user: { id: "test-admin", sedeId: officeId } } as { user: { id: string; sedeId: string } } | null,
    token: undefined as string | undefined,
    workers: [
      { ...base, id: ownerId, name: "Profilo titolare rinominato", sede_id: officeId, location: office },
      { ...localWorker, id: "test-no-site", sede_id: null, location: null, attendance_logs: [clockIn] },
      { ...localWorker, id: "test-no-clock", sede_id: null, location: null },
      { ...localWorker, id: "test-namesake", name: "Francesca", sede_id: officeId, location: office },
      { ...localWorker, id: "test-former", employee_status: FORMER_EMPLOYEE_STATUS },
      localWorker,
    ],
    prisma: {
      location: { findMany: async () => [salon, office], findUnique: async () => salon },
      setting: { findUnique: async ({ where }: { where: { key: string } }) => where.key === "appointments_authorized_pcs"
        ? { value: [{ locationId: salonId, accessTokenHash: createHash("sha256").update(pcToken).digest("hex"), archivedAt: null }] }
        : null },
      user: { findMany: async ({ where }: WorkerQuery) => fixture.workers.filter((worker) =>
        worker.active === where.active && worker.employee_status !== where.employee_status?.not &&
        (!where.OR || where.OR.some((filter) =>
          filter.sede_id?.in.includes(worker.sede_id ?? "") ||
          (filter.sede_id === null && worker.sede_id === null) ||
          filter.id === worker.id ||
          filter.name?.equals.toLowerCase() === worker.name.toLowerCase(),
        )),
      ) },
    },
  };

  // Exercise the real route with a synthetic session, cookies and database.
  const mocks: Record<string, string> = {
    "@/lib/auth": "export const auth = async () => fixture.session;",
    "next/headers": "export const cookies = async () => ({ get: () => ({ value: fixture.token }) });",
    prisma: "export const prisma = fixture.prisma;",
  };
  const result = await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    entryPoints: ["app/api/appointments/pc/active-staff/route.ts"],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    plugins: [{ name: "appointment-roster-fixture", setup(bundle) {
      bundle.onResolve({ filter: /^(?:@\/lib\/(?:auth|prisma)|next\/headers|\.\/prisma)$/ }, ({ path }) => ({
        path: path.endsWith("/prisma") ? "prisma" : path, namespace: "fixture",
      }));
      bundle.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js" }));
    } }],
  });
  const route = { exports: {} as typeof import("../app/api/appointments/pc/active-staff/route") };
  new Function("require", "module", "exports", "fixture", result.outputFiles[0].text)(
    createRequire(import.meta.url), route, route.exports, fixture,
  );

  const request = (query: string) => route.exports.GET(new NextRequest(`https://staff.example.test/api/appointments/pc/active-staff?${query}`));
  for (const query of ["scope=repubblica-board", "salone=repubblica&scope=salon"]) {
    if (query.includes("scope=salon")) {
      fixture.session = null;
      fixture.token = pcToken;
      fixture.workers[0] = { ...fixture.workers[0], name: "Franci", sede_id: null, location: null };
    }
    const response = await request(query);
    assert.equal(response.status, 200, query);
    const workers: RosterWorker[] = await response.json();
    assert.deepEqual(workers.map(({ id }) => id).sort(), [ownerId, "test-local", "test-no-site"].sort(), query);
    const owner: RosterWorker | undefined = workers.find(({ id }) => id === ownerId);
    assert.equal(owner?.name, "Francesca", query);
    assert.equal(owner?.alwaysActive, true, query);
    assert.equal(owner?.clockedInAt, null, query);
    assert.equal(workers.find(({ id }) => id === "test-local")?.status, "OUT", query);
    assert.equal(workers.find(({ id }) => id === "test-no-site")?.clockedInAt, clockIn.timestamp, query);
  }
});
