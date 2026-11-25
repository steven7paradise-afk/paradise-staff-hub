import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { pinLookup } from "@/lib/pin";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

export type MagazzinoWorker = { dipendente_id: string; nome: string; attivo: true };
export type MagazzinoPinResult = { ok: false } | ({ ok: true } & MagazzinoWorker);

const eligibleWorker = { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS } } as const;
// Synthetic cost-12 hash; its comparison result never authenticates a worker.
const DUMMY_PIN_HASH = "$2a$12$TtHbsc6tXfsCeji3q4T9E.3HyfzcrDFxhxP2XozQpG3poSwlTA7ui";

function workerIdentity(worker: { id: string; name: string }): MagazzinoWorker {
  return { dipendente_id: worker.id, nome: worker.name, attivo: true };
}

export async function listMagazzinoWorkers(): Promise<MagazzinoWorker[]> {
  const workers = await prisma.user.findMany({
    where: eligibleWorker,
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return workers.map(workerIdentity);
}

export async function verifyMagazzinoPin(pin: unknown): Promise<MagazzinoPinResult> {
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) return { ok: false };

  const candidates = await prisma.user.findMany({
    where: {
      ...eligibleWorker,
      pin_hash: { not: null },
      OR: [{ pin_lookup: pinLookup(pin) }, { pin_lookup: null }],
    },
    select: { id: true, name: true, pin_hash: true },
  });
  if (!candidates.length) {
    await bcrypt.compare(pin, DUMMY_PIN_HASH);
    return { ok: false };
  }

  let matches = 0;
  let selected: MagazzinoWorker | null = null;
  for (const candidate of candidates) {
    // bcryptjs.compare uses a full-length safeStringCompare after hashing.
    const valid = await bcrypt.compare(pin, candidate.pin_hash ?? DUMMY_PIN_HASH).catch(() => false);
    if (candidate.pin_hash && valid) {
      matches++;
      selected = workerIdentity(candidate);
    }
  }
  return matches === 1 && selected ? { ok: true, ...selected } : { ok: false };
}
