import { syncAppointmentArchive, readAppointmentArchive } from "../lib/appointment-archive";
import { appointmentMonthRange } from "../lib/appointment-date";
import { prisma } from "../lib/prisma";

async function main() {
  const months = process.argv.slice(2);
  if (!months.length) throw new Error("Indica uno o più mesi YYYY-MM");
  for (const month of months) {
    await syncAppointmentArchive(month, true);
    const range = appointmentMonthRange(`${month}-01`);
    const result = await readAppointmentArchive(range.start, range.end, { page: 1 });
    console.log(JSON.stringify({ month, ready: result.ready, failed: result.failed, count: result.count, updatedAt: result.updatedAt }));
    if (!result.ready || result.failed) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Importazione fallita"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
