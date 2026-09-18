import { createHash, createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

function fullPinLookup(pin) {
  return createHash("sha256")
    .update(`paradise-staff-hub-pin-v1:${pin}`)
    .digest("hex");
}

function prefixLookup(pin) {
  return createHmac("sha256", secret)
    .update(`paradise-staff-hub-pin-prefix-v1:${pin.slice(0, 2)}`)
    .digest("hex");
}

async function main() {
  if (!secret) throw new Error("NEXTAUTH_SECRET o AUTH_SECRET mancante");

  const users = await prisma.user.findMany({
    where: {
      pin_lookup: { not: null },
      pin_prefix_lookup: null,
    },
    select: { id: true, pin_lookup: true },
  });

  if (!users.length) {
    console.log("Prefissi PIN gia aggiornati.");
    return;
  }

  const unresolved = new Map(
    users.map((user) => [user.pin_lookup, user.id]),
  );
  const resolved = [];

  // I PIN generati dall'app sono a 6 cifre. Le lunghezze 4 e 5 restano
  // supportate per i PIN inseriti manualmente in passato.
  for (const length of [6, 4, 5]) {
    const combinations = 10 ** length;
    for (let value = 0; value < combinations && unresolved.size; value += 1) {
      const candidate = String(value).padStart(length, "0");
      const lookup = fullPinLookup(candidate);
      const userId = unresolved.get(lookup);
      if (!userId) continue;
      resolved.push({ userId, prefix: prefixLookup(candidate) });
      unresolved.delete(lookup);
    }
    if (!unresolved.size) break;
  }

  await prisma.$transaction(
    resolved.map(({ userId, prefix }) =>
      prisma.user.update({
        where: { id: userId },
        data: { pin_prefix_lookup: prefix },
      }),
    ),
  );

  console.log(`Prefissi PIN aggiornati: ${resolved.length}/${users.length}.`);
  if (unresolved.size) {
    console.warn(`PIN non ricostruibili: ${unresolved.size}. Impostare nuovamente quei PIN dallo staff.`);
  }
}

main()
  .catch((error) => {
    console.error("Aggiornamento prefissi PIN fallito:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
