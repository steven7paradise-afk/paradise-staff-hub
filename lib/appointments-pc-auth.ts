import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";
import { isAppointmentPinOnlyRole } from "./appointment-pin-entry";
import { hasCurrentAttendanceAtAppointmentSalon, isAlwaysActiveAppointmentStaff } from "./appointment-staff-access";
import { appointmentDateKey } from "./appointment-date";
import { deriveAttendanceState } from "./attendance-state";
import { appointmentSalonSlugFromName, isCashierAppointmentSalon, repubblicaIncludesLegacyBuenosAires, type AppointmentSalonSlug } from "./appointment-salon-url";

export const appointmentsPcCookieName = "appointments_pc_token";
export const appointmentsPcWorkerCookieName = "appointments_pc_worker";
export const appointmentsPcWorkerCookieMaxAgeSeconds = 5 * 60;
export const appointmentsRemoteTargetCookieName = "appointments_remote_target";
export const appointmentsRemoteWorkerCookieName = "appointments_remote_worker";
export const appointmentsRemoteCookieMaxAgeSeconds = 2 * 60 * 60;

export interface AuthorizedPC {
  code: string;
  name: string;
  locationId: string;
  createdAt: string;
  activatedAt: string | null;
  accessTokenHash: string | null;
  registeredIp: string | null;
  archivedAt: string | null;
}

type PCAuthorization = { code: string; name: string; locationId: string; isPC: boolean };
const pcAuthorizationCache = new Map<string, { value: PCAuthorization; expiresAt: number }>();
const PC_AUTH_CACHE_MS = 5_000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function generateOneTimeCode(locationId: string, name: string): Promise<string> {
  const code = randomUUID();

  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];

  const newList: AuthorizedPC[] = [
    ...currentList,
    {
      code,
      name,
      locationId,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      accessTokenHash: null,
      registeredIp: null,
      archivedAt: null,
    },
  ];

  await prisma.setting.upsert({
    where: { key: "appointments_authorized_pcs" },
    update: { value: newList as any },
    create: { key: "appointments_authorized_pcs", value: newList as any },
  });

  return code;
}

export class PCActivationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function appointmentSalonForPC(locationId: string) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { active: true, name: true },
  });
  return location?.active ? appointmentSalonSlugFromName(location.name) : null;
}

export async function appointmentStaffLocationsForPC(locationId: string, salon: AppointmentSalonSlug) {
  if (salon !== "repubblica") return [locationId];
  const locations = await prisma.location.findMany({ select: { id: true, active: true, name: true } });
  if (!repubblicaIncludesLegacyBuenosAires(locations, locationId)) return [locationId];
  return [locationId, ...locations
    .filter((location) => !location.active && appointmentSalonSlugFromName(location.name) === "buenos-aires")
    .map((location) => location.id)];
}

export async function isAppointmentStaffLocationForPC(locationId: string, staffLocationId: string) {
  if (locationId === staffLocationId) return true;
  const salon = await appointmentSalonForPC(locationId);
  if (salon !== "repubblica") return false;
  return (await appointmentStaffLocationsForPC(locationId, salon)).includes(staffLocationId);
}

export async function hasRepubblicaAttendanceForUnassignedWorker(locationId: string, workerId: string) {
  const today = new Date(`${appointmentDateKey()}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const [logs, locationIds] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { user_id: workerId, date: { gte: today, lt: tomorrow } },
      select: { type: true, timestamp: true, location_id: true },
    }),
    appointmentStaffLocationsForPC(locationId, "repubblica"),
  ]);
  const state = deriveAttendanceState(logs);
  return hasCurrentAttendanceAtAppointmentSalon(state.status, state.lastValidLog?.location_id, locationIds);
}

export async function findAppointmentPcWorker(locationId: string, salon: AppointmentSalonSlug | null, cookieValue?: string) {
  if (!cookieValue) return null;
  let identity: string;
  try { identity = decodeURIComponent(cookieValue).trim(); } catch { return null; }
  if (!identity) return null;
  const worker = await prisma.user.findFirst({
    where: {
      active: true,
      employee_status: { not: FORMER_EMPLOYEE_STATUS },
      OR: [{ id: identity }, { name: identity }],
    },
    select: { id: true, name: true, sede_id: true, role: true },
  });
  if (!worker) return null;
  if (worker.sede_id === null || worker.sede_id === locationId || isAppointmentPinOnlyRole(worker.role) ||
      isAlwaysActiveAppointmentStaff(worker.name, worker.id)) return worker;
  return salon === "repubblica" && (await appointmentStaffLocationsForPC(locationId, salon)).includes(worker.sede_id)
    ? worker : null;
}

export async function activatePC(code: string, ip: string | null) {
  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const pc = currentList.find((item) => item.code === code && item.activatedAt === null && !item.archivedAt);

  if (!setting || !pc) {
    throw new PCActivationError("Codice di attivazione non valido o già utilizzato.", 410);
  }

  const salon = await appointmentSalonForPC(pc.locationId);
  if (!isCashierAppointmentSalon(salon)) {
    throw new PCActivationError("La sede associata a questo link non è disponibile.", 409);
  }

  const accessToken = randomBytes(32).toString("hex");
  const activatedPc = {
    ...pc,
    activatedAt: new Date().toISOString(),
    accessTokenHash: hashToken(accessToken),
    registeredIp: ip,
  };

  const updated = await prisma.setting.updateMany({
    where: { key: setting.key, value: { equals: currentList.map((item) => ({ ...item })) } },
    data: { value: currentList.map((item) => ({ ...(item === pc ? activatedPc : item) })) },
  });
  if (updated.count !== 1) throw new PCActivationError("Il codice è cambiato durante l’attivazione. Riapri il link e riprova.", 409);

  return { accessToken, name: pc.name, locationId: pc.locationId, salon };
}

export async function reconnectPC(code: string, ip: string | null): Promise<{ accessToken: string; name: string; locationId: string }> {
  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });
  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const index = currentList.findIndex((item) => item.code === code && item.activatedAt && !item.archivedAt);
  if (index === -1) throw new Error("PC non disponibile o non autorizzato.");

  const accessToken = randomBytes(32).toString("hex");
  if (currentList[index].accessTokenHash) pcAuthorizationCache.delete(currentList[index].accessTokenHash!);
  currentList[index] = {
    ...currentList[index],
    accessTokenHash: hashToken(accessToken),
    registeredIp: ip,
    activatedAt: new Date().toISOString(),
  };
  await prisma.setting.update({
    where: { key: "appointments_authorized_pcs" },
    data: { value: currentList as any },
  });
  return { accessToken, name: currentList[index].name, locationId: currentList[index].locationId };
}

export async function checkPCAuthorization(cookieToken: string | undefined): Promise<PCAuthorization | null> {
  if (!cookieToken) return null;

  const accessTokenHash = hashToken(cookieToken);
  const cached = pcAuthorizationCache.get(accessTokenHash);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) pcAuthorizationCache.delete(accessTokenHash);

  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const found = currentList.find((item) => item.accessTokenHash === accessTokenHash && item.archivedAt === null);

  if (!found) return null;

  const authorization = {
    code: found.code,
    name: found.name,
    locationId: found.locationId,
    isPC: true,
  };
  pcAuthorizationCache.set(accessTokenHash, { value: authorization, expiresAt: Date.now() + PC_AUTH_CACHE_MS });
  if (pcAuthorizationCache.size > 100) {
    const now = Date.now();
    for (const [key, entry] of pcAuthorizationCache) if (entry.expiresAt <= now) pcAuthorizationCache.delete(key);
  }
  return authorization;
}

export async function verifyOneTimeCode(code: string): Promise<AuthorizedPC> {
  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const pc = currentList.find((item) => item.code === code && item.activatedAt === null && !item.archivedAt);

  if (!pc) {
    throw new Error("Codice di attivazione non valido o già utilizzato.");
  }

  return pc;
}
