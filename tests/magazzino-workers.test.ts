import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import bcrypt from "bcryptjs";
import { FORMER_EMPLOYEE_STATUS } from "../lib/former-employee";

type WorkerRow = {
  id: string; name: string; active: boolean; employee_status: string;
  pin_hash: string | null; pin_lookup: string | null; role: string;
};
type WorkerQuery = {
  where: {
    active: boolean; employee_status: { not: string };
    pin_hash?: { not: null }; OR?: Array<{ pin_lookup: string | null }>;
  };
  select: Record<string, boolean>;
  orderBy?: Array<{ name?: string; id?: string }>;
};

const lookup = (pin: string) => createHash("sha256").update(`paradise-staff-hub-pin-v1:${pin}`).digest("hex");
const submittedPin = "012345";
const otherPin = "7890";
const submittedHash = bcrypt.hashSync(submittedPin, 4);
const otherHash = bcrypt.hashSync(otherPin, 4);
const worker = (id: string, overrides: Partial<WorkerRow> = {}): WorkerRow => ({
  id, name: `Worker ${id}`, active: true, employee_status: "Attivo", role: "DIPENDENTE",
  pin_hash: submittedHash, pin_lookup: lookup(submittedPin), ...overrides,
});

const compiled = build({
  absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
  entryPoints: ["lib/magazzino/workers.ts"],
  bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "magazzino-workers-prisma", setup(bundle) {
    bundle.onResolve({ filter: /^(?:@\/lib\/prisma|\.\/prisma)$/ }, () => ({ path: "prisma", namespace: "fixture" }));
    bundle.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const prisma = fixture.prisma;", loader: "js" }));
  } }],
}).then(result => result.outputFiles[0].text);

async function fixture(rows: WorkerRow[]) {
  const queries: WorkerQuery[] = [];
  const writes: string[] = [];
  const state = { rows };
  const prisma = { user: new Proxy({
    async findMany(query: WorkerQuery) {
      queries.push(query);
      const { where } = query;
      const result = state.rows.filter(row => row.active === where.active
        && row.employee_status !== where.employee_status.not
        && (!where.pin_hash || row.pin_hash !== null)
        && (!where.OR || where.OR.some(condition => condition.pin_lookup === row.pin_lookup)));
      if (query.orderBy) result.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      return result.map(row => Object.fromEntries(Object.entries(query.select)
        .filter(([, selected]) => selected).map(([key]) => [key, row[key as keyof WorkerRow]])));
    },
  }, {
    get(target, property) {
      if (property === "findMany") return target.findMany;
      return () => { writes.push(String(property)); throw new Error("Unexpected database operation"); };
    },
  }) };
  const workerModule = { exports: {} as typeof import("../lib/magazzino/workers") };
  new Function("require", "module", "exports", "fixture", await compiled)(
    createRequire(import.meta.url), workerModule, workerModule.exports, { prisma },
  );
  return { ...workerModule.exports, queries, writes, state };
}

test("Magazzino accepts only full numeric PIN strings without normalizing leading zeros", async t => {
  const world = await fixture([]);
  const comparisons = t.mock.method(bcrypt, "compare");
  for (const invalid of [undefined, null, 1234, {}, "", "12", "123", "1234567", " 1234", "1234 ", "12a4", "１２３４"]) {
    assert.deepEqual(await world.verifyMagazzinoPin(invalid), { ok: false });
  }
  assert.equal(world.queries.length, 0);
  assert.equal(comparisons.mock.callCount(), 0);
  assert.deepEqual(world.writes, []);
});

test("the indexed candidate still requires bcrypt and returns only the worker identity", async t => {
  const world = await fixture([worker("indexed")]);
  const comparisons = t.mock.method(bcrypt, "compare");
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), {
    ok: true, dipendente_id: "indexed", nome: "Worker indexed", attivo: true,
  });
  assert.equal(comparisons.mock.callCount(), 1);
  assert.deepEqual(world.queries[0], {
    where: {
      active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, pin_hash: { not: null },
      OR: [{ pin_lookup: lookup(submittedPin) }, { pin_lookup: null }],
    },
    select: { id: true, name: true, pin_hash: true },
  });
  assert.deepEqual(world.writes, []);
});

test("four- and five-digit PINs also retain their leading zeros", async () => {
  for (const pin of ["0042", "01234"]) {
    const world = await fixture([worker("shorter", { pin_lookup: lookup(pin), pin_hash: bcrypt.hashSync(pin, 4) })]);
    assert.deepEqual(await world.verifyMagazzinoPin(pin), {
      ok: true, dipendente_id: "shorter", nome: "Worker shorter", attivo: true,
    });
    assert.deepEqual(world.writes, []);
  }
});

test("an unknown PIN performs a cost-12 dummy bcrypt comparison and exposes no identity", async t => {
  const world = await fixture([worker("unrelated", { pin_lookup: lookup(otherPin), pin_hash: otherHash })]);
  const comparisons = t.mock.method(bcrypt, "compare");
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
  assert.equal(comparisons.mock.callCount(), 1);
  assert.equal(bcrypt.getRounds(comparisons.mock.calls[0].arguments[1]), 12);
  assert.deepEqual(world.writes, []);
});

test("a matching lookup cannot authenticate a discordant bcrypt hash", async t => {
  const world = await fixture([worker("mismatch", { pin_hash: otherHash })]);
  const comparisons = t.mock.method(bcrypt, "compare");
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
  assert.equal(comparisons.mock.callCount(), 1);
  assert.deepEqual(world.writes, []);
});

test("a sole legacy match authenticates without writing a lookup or prefix", async () => {
  const legacy = worker("legacy", { pin_lookup: null });
  const world = await fixture([legacy]);
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), {
    ok: true, dipendente_id: "legacy", nome: "Worker legacy", attivo: true,
  });
  assert.equal(legacy.pin_lookup, null);
  assert.deepEqual(world.writes, []);
});

test("legacy ambiguity is rejected only after checking every candidate", async t => {
  const legacyHash = bcrypt.hashSync(submittedPin, 4);
  assert.notEqual(legacyHash, submittedHash, "equal synthetic PINs have independently salted hashes");
  const world = await fixture([
    worker("indexed"),
    worker("legacy", { pin_lookup: null, pin_hash: legacyHash }),
    worker("last-legacy", { pin_lookup: null, pin_hash: otherHash }),
  ]);
  const comparisons = t.mock.method(bcrypt, "compare");
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
  assert.equal(comparisons.mock.callCount(), 3, "do not stop after the first or second matching worker");
  assert.deepEqual(world.writes, []);
  world.state.rows[0].pin_lookup = null;
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
  assert.equal(comparisons.mock.callCount(), 6, "two legacy matches must also be rejected");
});

test("inactive and former workers cannot authenticate even when their PIN matches", async () => {
  for (const excluded of [
    worker("disabled", { active: false }),
    worker("former", { employee_status: FORMER_EMPLOYEE_STATUS }),
    worker("missing-hash", { pin_hash: null }),
  ]) {
    const world = await fixture([excluded]);
    assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
    assert.deepEqual(world.writes, []);
  }
});

test("worker listing includes every eligible role and unconfigured PIN, without credential fields", async () => {
  const world = await fixture([
    worker("z", { name: "Zeta", role: "ZERO" }),
    worker("a", { name: "Alfa", pin_hash: null, pin_lookup: null }),
    worker("disabled", { active: false }),
    worker("former", { employee_status: FORMER_EMPLOYEE_STATUS }),
  ]);
  assert.deepEqual(await world.listMagazzinoWorkers(), [
    { dipendente_id: "a", nome: "Alfa", attivo: true },
    { dipendente_id: "z", nome: "Zeta", attivo: true },
  ]);
  assert.deepEqual(world.queries[0], {
    where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS } },
    select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  assert.deepEqual(world.writes, []);
});

test("credential changes and deactivation take effect without a cached PIN result", async () => {
  const person = worker("fresh");
  const world = await fixture([person]);
  assert.equal((await world.verifyMagazzinoPin(submittedPin)).ok, true);
  person.pin_hash = otherHash;
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
  person.pin_hash = submittedHash;
  person.active = false;
  assert.deepEqual(await world.verifyMagazzinoPin(submittedPin), { ok: false });
  assert.equal(world.queries.length, 3);
  assert.deepEqual(world.writes, []);
});
