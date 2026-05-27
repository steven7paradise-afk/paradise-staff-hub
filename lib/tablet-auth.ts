import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const tabletCookieName = "paradise_tablet_access";
export const tabletDeviceCookieName = "paradise_tablet_device";

export function newTabletToken() {
  return randomBytes(32).toString("hex");
}

export function hashTabletToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function requestIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}

export async function authorizedTablet(deviceId: string, accessToken: string | undefined, ip: string | null) {
  if (!deviceId || !accessToken || !ip) return null;
  const device = await prisma.device.findUnique({
    where: { device_id: deviceId },
    include: { location: true },
  });
  if (
    !device ||
    device.status !== "ACTIVE" ||
    device.archived_at ||
    !device.access_token_hash ||
    !device.registered_ip ||
    device.registered_ip !== ip ||
    device.access_token_hash !== hashTabletToken(accessToken)
  ) {
    return null;
  }
  return device;
}
