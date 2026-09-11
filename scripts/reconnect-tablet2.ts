import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const targetCode = "d6835e63-d7f4-4676-82ea-17c266fa6f06"; // Tablet Buenos Aires 2
  const targetCodeDuomo = "4124ffab-6a46-4b78-ad4e-02628fc4f2e8"; // Tablet Duomo 2

  const reconnectSetting = await prisma.setting.findUnique({
    where: { key: "appointments_remote_reconnect_requests" },
  });

  const reconnectRequests: Record<string, any> = (reconnectSetting?.value as Record<string, any>) || {};
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  reconnectRequests[targetCode] = {
    requestedAt: now.toISOString(),
    requestedBy: "Amministratore (Antigravity)",
    expiresAt,
  };

  reconnectRequests[targetCodeDuomo] = {
    requestedAt: now.toISOString(),
    requestedBy: "Amministratore (Antigravity)",
    expiresAt,
  };

  await prisma.setting.upsert({
    where: { key: "appointments_remote_reconnect_requests" },
    update: { value: reconnectRequests },
    create: { key: "appointments_remote_reconnect_requests", value: reconnectRequests },
  });

  console.log("Successfully sent 24h reconnect request pop-up for Tablet 2 (Buenos Aires & Duomo)!");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
