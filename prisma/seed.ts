import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { pinLookup } from "../lib/pin";

const prisma = new PrismaClient();

async function main() {
  const locations = [
    { id: "loc-duomo", name: "Paradise Duomo", address: "Via Duomo 01", phone: "+39 02 0000 1001", opening_time: "09:00", closing_time: "20:00" },
    { id: "loc-brera", name: "Paradise Brera", address: "Via Fiori Chiari 12", phone: "+39 02 0000 1002", opening_time: "09:00", closing_time: "20:00" },
    { id: "loc-roma", name: "Paradise Roma Parioli", address: "Via Archimede 84", phone: "+39 06 0000 1003", opening_time: "09:30", closing_time: "20:00" },
    { id: "loc-torino", name: "Paradise Torino Centro", address: "Via Lagrange 7", phone: "+39 011 0000 1004", opening_time: "09:00", closing_time: "19:30" },
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: { id: location.id },
      update: location,
      create: location,
    });
  }

  const devices = [
    { device_id: "PB-DUOMO-TAB-01", device_name: "Tablet Duomo 01", location_id: "loc-duomo" },
    { device_id: "PB-BRERA-TAB-01", device_name: "Tablet Brera 01", location_id: "loc-brera" },
    { device_id: "PB-ROMA-TAB-01", device_name: "Tablet Roma 01", location_id: "loc-roma" },
    { device_id: "PB-TORINO-TAB-01", device_name: "Tablet Torino 01", location_id: "loc-torino" },
  ];

  for (const device of devices) {
    await prisma.device.upsert({
      where: { device_id: device.device_id },
      update: device,
      create: device,
    });
  }

  const defaultPasswordHash = await bcrypt.hash("ChangeMe123!", 12);
  const users = [
    { id: "u-super-admin", name: "Paradise Super Admin", email: "admin@paradisebeauty.it", role: UserRole.SUPER_ADMIN, sede_id: "loc-duomo", pin: "1000", fiscal_code: "PRDADM90A01F205X", contract_start: "2026-01-01", contract_end: "2026-12-31" },
    { id: "u-noemi", name: "Noemi Costa", email: "noemi@paradisebeauty.it", role: UserRole.DIPENDENTE, sede_id: "loc-duomo", pin: "3333", birth_date: "1996-04-12", fiscal_code: "CSTNMO96D52F205X", contract_start: "2026-01-15", contract_end: "2026-12-31", photo_url: "" },
    { id: "u-giulia", name: "Giulia Martini", email: "giulia@paradisebeauty.it", role: UserRole.ADMIN, sede_id: "loc-brera", pin: "6666", fiscal_code: "MRTGLI92B44F205X", contract_start: "2026-01-01", contract_end: "2027-01-01" },
    { id: "u-camilla", name: "Camilla Riva", email: "camilla@paradisebeauty.it", role: UserRole.RESPONSABILE, sede_id: "loc-roma", pin: "7777", fiscal_code: "RVACML91C51H501X", contract_start: "2026-02-01", contract_end: "2026-11-30" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        sede_id: user.sede_id,
        pin_hash: await bcrypt.hash(user.pin, 12),
        pin_lookup: pinLookup(user.pin),
        birth_date: user.birth_date ? new Date(user.birth_date) : null,
        fiscal_code: user.fiscal_code ?? null,
        contract_start: user.contract_start ? new Date(user.contract_start) : null,
        contract_end: user.contract_end ? new Date(user.contract_end) : null,
        photo_url: user.photo_url ?? null,
        active: true,
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        password_hash: defaultPasswordHash,
        role: user.role,
        sede_id: user.sede_id,
        pin_hash: await bcrypt.hash(user.pin, 12),
        pin_lookup: pinLookup(user.pin),
        birth_date: user.birth_date ? new Date(user.birth_date) : null,
        fiscal_code: user.fiscal_code ?? null,
        contract_start: user.contract_start ? new Date(user.contract_start) : null,
        contract_end: user.contract_end ? new Date(user.contract_end) : null,
        photo_url: user.photo_url ?? null,
      },
    });
  }

  const branding = await prisma.brandingSetting.findFirst();
  if (!branding) {
    await prisma.brandingSetting.create({ data: {} });
  }

  const categories = [
    { code: "M", name: "Mattina", color: "#9FC5E8", text_color: "#123047", start_time: "09:00", end_time: "14:00", paid_hours: 5 },
    { code: "P", name: "Pomeriggio", color: "#C9B2DB", text_color: "#2B183D", start_time: "14:00", end_time: "20:00", paid_hours: 6 },
    { code: "ML", name: "Malattia", color: "#E00000", text_color: "#FFFFFF" },
    { code: "F", name: "Ferie", color: "#F4CCCC", text_color: "#5E1F1F" },
    { code: "PE", name: "Permesso", color: "#D9EAD3", text_color: "#23451F" },
    { code: "R", name: "Riposo", color: "#FFF2CC", text_color: "#4A3900" },
  ];

  for (const location of locations) {
    for (const category of categories) {
      await prisma.scheduleCategory.upsert({
        where: {
          code_location_id: {
            code: category.code,
            location_id: location.id,
          },
        },
        update: {
          ...category,
          location_id: location.id,
        },
        create: {
          ...category,
          location_id: location.id,
        },
      });
    }
  }

  await prisma.document.upsert({
    where: { id: "doc-noemi-aprile-2026" },
    update: {},
    create: {
      id: "doc-noemi-aprile-2026",
      user_id: "u-noemi",
      title: "Busta paga Aprile 2026",
      file_url: "https://example.com/private/noemi-aprile-2026.pdf",
      type: "Busta paga",
      month: 4,
      year: 2026,
      uploaded_by: "u-super-admin",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
