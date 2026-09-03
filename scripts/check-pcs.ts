import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const [pcsSetting, presenceSetting, reconnectSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "appointments_authorized_pcs" } }),
    prisma.setting.findUnique({ where: { key: "appointments_remote_presence" } }),
    prisma.setting.findUnique({ where: { key: "appointments_remote_reconnect_requests" } }),
  ]);

  console.log("=== AUTHORIZED PCS ===");
  const pcs = (pcsSetting?.value as any[]) || [];
  pcs.forEach(pc => {
    console.log(`Code: ${pc.code} | Name: ${pc.name} | LocationId: ${pc.locationId} | Active: ${pc.activatedAt ? 'YES' : 'NO'}`);
  });

  console.log("\n=== PRESENCE ===");
  console.log(presenceSetting?.value);

  console.log("\n=== RECONNECT REQUESTS ===");
  console.log(reconnectSetting?.value);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
