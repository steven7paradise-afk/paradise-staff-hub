import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { CLIENT_CONTROL_FIELD_IDS, ensureClientControlForm } from "../lib/client-control-form";

const prisma = new PrismaClient();
const IMPORT_SOURCE = "client_control_pasted_2026_06_26";

function clean(value: string | undefined) {
  return String(value ?? "").trim();
}

function yesNo(value: string | undefined) {
  const text = clean(value).toLowerCase();
  return ["yes", "si", "sì", "true", "1", "ok"].includes(text);
}

function money(value: string | undefined) {
  const text = clean(value).replace(",", ".");
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLocationName(value: string) {
  const text = value.trim().toUpperCase();
  if (text.includes("DUOMO")) return "Salone Duomo";
  if (text.includes("BUENOS")) return "Salone Buenos Aires";
  if (text.includes("UFFICIO")) return "Ufficio Paradise";
  return value.trim() || "Senza sede";
}

function normalizeStatus(value: string) {
  const text = value.trim().toLowerCase();
  if (text.includes("errore")) return "Errore";
  if (text.includes("controllato") || text.includes("corretto")) return "Controllato";
  return "Da controllare";
}

function parseImportedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function comparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function importKey(values: string[]) {
  return values.map((value) => clean(value)).join("||");
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Passa il percorso del file TSV da importare.");
  }

  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((columns) => columns.some((column) => clean(column)));

  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    orderBy: { created_at: "asc" },
    select: { id: true, name: true, role: true, sede_id: true },
  });
  if (!admin) throw new Error("Nessun admin trovato per firmare l'import.");

  const form = await ensureClientControlForm(admin.id);
  const [users, locations, existingImported] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, sede_id: true },
    }),
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.serviceFormResponse.findMany({
      where: {
        form_id: form.id,
        internal_notes: {
          path: ["import_source"],
          equals: IMPORT_SOURCE,
        },
      },
      select: { internal_notes: true },
    }).catch(() => []),
  ]);

  const existingKeys = new Set(
    existingImported
      .map((response) => (response.internal_notes as any)?.import_key)
      .filter(Boolean)
      .map(String)
  );
  const locationByName = new Map(locations.map((location) => [comparable(location.name), location]));

  function findUser(staffName: string) {
    const target = comparable(staffName);
    if (!target) return null;
    const exact = users.find((user) => comparable(user.name) === target);
    if (exact) return exact;
    const targetParts = target.split(" ").filter(Boolean);
    return users.find((user) => {
      const userText = comparable(user.name);
      return targetParts.every((part) => userText.includes(part)) || userText.includes(target);
    }) ?? null;
  }

  let created = 0;
  let skipped = 0;

  for (const columns of rows) {
    const [
      clientNameRaw,
      staffRaw,
      locationRaw,
      depositRaw,
      paidRaw,
      notesRaw,
      beforeRaw,
      afterRaw,
      instagramRaw,
      shopifyRaw,
      productsRaw,
      reviewRaw,
      correctnessRaw,
      createdRaw,
      updatedRaw,
    ] = columns;

    const key = importKey(columns);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const staffName = clean(staffRaw) || "Senza responsabile";
    const matchedUser = findUser(staffName);
    const locationName = normalizeLocationName(clean(locationRaw));
    const location = locationByName.get(comparable(locationName)) ?? null;
    const createdAt = parseImportedDate(clean(createdRaw));
    const updatedAt = parseImportedDate(clean(updatedRaw) || clean(createdRaw));

    const answers = {
      [CLIENT_CONTROL_FIELD_IDS.location]: locationName,
      [CLIENT_CONTROL_FIELD_IDS.clientName]: clean(clientNameRaw) || "-",
      [CLIENT_CONTROL_FIELD_IDS.depositPaid]: money(depositRaw),
      [CLIENT_CONTROL_FIELD_IDS.paid]: money(paidRaw),
      [CLIENT_CONTROL_FIELD_IDS.serviceOwner]: staffName,
      [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: [staffName],
      [CLIENT_CONTROL_FIELD_IDS.shopifyOrder]: clean(shopifyRaw),
      [CLIENT_CONTROL_FIELD_IDS.notes]: yesNo(notesRaw),
      [CLIENT_CONTROL_FIELD_IDS.beforeMedia]: yesNo(beforeRaw),
      [CLIENT_CONTROL_FIELD_IDS.afterMedia]: yesNo(afterRaw),
      [CLIENT_CONTROL_FIELD_IDS.instagramTag]: clean(instagramRaw),
      [CLIENT_CONTROL_FIELD_IDS.products]: yesNo(productsRaw),
      [CLIENT_CONTROL_FIELD_IDS.review]: yesNo(reviewRaw),
      [CLIENT_CONTROL_FIELD_IDS.correctness]: normalizeStatus(clean(correctnessRaw)),
    };

    await prisma.serviceFormResponse.create({
      data: {
        form_id: form.id,
        user_id: matchedUser?.id ?? admin.id,
        user_role: matchedUser?.role ?? admin.role,
        user_location_id: location?.id ?? matchedUser?.sede_id ?? null,
        user_location_name: location?.name ?? locationName,
        answers,
        status: "COMPLETED",
        internal_notes: {
          import_source: IMPORT_SOURCE,
          import_key: key,
          imported_at: new Date().toISOString(),
          source_file: resolvedPath,
          original_row: columns,
          matched_user_id: matchedUser?.id ?? null,
          matched_user_name: matchedUser?.name ?? null,
        },
        created_at: createdAt,
        updated_at: updatedAt,
      },
    });
    existingKeys.add(key);
    created += 1;
  }

  console.log(JSON.stringify({ rows: rows.length, created, skipped, formId: form.id }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
