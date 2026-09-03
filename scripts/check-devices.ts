import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const [pcsSetting, presenceSetting, sessionsSetting, reconnectSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "appointments_authorized_pcs" } }),
    prisma.setting.findUnique({ where: { key: "appointments_remote_presence" } }),
    prisma.setting.findUnique({ where: { key: "appointments_remote_sessions" } }),
    prisma.setting.findUnique({ where: { key: "appointments_remote_reconnect_requests" } }),
  ]);

  console.log("=== AUTHORIZED PCS (setting: appointments_authorized_pcs) ===");
  console.log(JSON.stringify(pcsSetting?.value, null, 2));

  console.log("\n=== PRESENCE (setting: appointments_remote_presence) ===");
  console.log(JSON.stringify(presenceSetting?.value, null, 2));

  console.log("\n=== SESSIONS (setting: appointments_remote_sessions) ===");
  console.log(JSON.stringify(sessionsSetting?.value, null, 2));

  console.log("\n=== RECONNECT REQUESTS (setting: appointments_remote_reconnect_requests) ===");
  console.log(JSON.stringify(reconnectSetting?.value, null, 2));

  const devices = await prisma.device.findMany();
  console.log("\n=== DEVICES TABLE (prisma.device) ===");
  console.log(JSON.stringify(devices, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
