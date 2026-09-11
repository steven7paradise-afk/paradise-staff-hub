import { prisma } from "@/lib/prisma";

const REMOTE_SESSIONS_KEY = "appointments_remote_sessions";

type StoredRemoteSession = {
  active?: boolean;
  controllerId?: string;
  workerId?: string | null;
  expiresAt?: string;
};

export async function resolveRemoteControllerWorker(
  controllerId: string,
  targetCode: string,
  expectedWorkerId?: string,
) {
  if (!controllerId || !targetCode) return null;

  const setting = await prisma.setting.findUnique({ where: { key: REMOTE_SESSIONS_KEY } }).catch(() => null);
  const sessions = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
    ? setting.value as Record<string, StoredRemoteSession>
    : {};
  const remote = sessions[targetCode];
  const expiresAt = Date.parse(remote?.expiresAt || "");
  if (
    !remote?.active ||
    remote.controllerId !== controllerId ||
    !remote.workerId ||
    (expectedWorkerId && remote.workerId !== expectedWorkerId) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) return null;

  return prisma.user.findFirst({
    where: { id: remote.workerId, active: true },
    select: { id: true, name: true, email: true, role: true, sede_id: true, photo_url: true },
  }).catch(() => null);
}
