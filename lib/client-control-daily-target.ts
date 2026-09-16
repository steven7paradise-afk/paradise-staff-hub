import { CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";

export const DAILY_CLIENT_CONTROL_TARGET = 5;

export type DailyControlResponse = {
  created_at: string;
  answers: Record<string, unknown>;
  user_location_name: string | null;
  user: { name: string | null };
};

export type DailyTargetWorker = {
  name: string;
  controls: number;
  remaining: number;
  aboveTarget: number;
  reachedTarget: boolean;
};

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isCompletedAppointment(answers: Record<string, unknown>) {
  const status = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare")
    .trim()
    .toLowerCase();
  return !["errore", "finito", "no show"].includes(status);
}

function responseSalon(response: DailyControlResponse) {
  return String(
    response.answers[CLIENT_CONTROL_FIELD_IDS.location] ||
      response.user_location_name ||
      "Senza sede",
  );
}

function responseStaff(response: DailyControlResponse, employeeNames: string[]) {
  const answers = response.answers ?? {};
  const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
  const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
  const rawNames = selectedStaff.length
    ? selectedStaff
    : fallbackOwner.length
      ? fallbackOwner
      : [response.user.name ?? ""];

  return [...new Set(rawNames
    .map((name) => resolveCanonicalStaffName(name, employeeNames))
    .filter((name) => name && name.toLowerCase() !== "no show"))];
}

export function romeDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildDailyClientControlTarget({
  responses,
  employeeNames,
  dateKey,
  salon,
  selectedWorkerName = "",
  allowedStaffNames = [],
  target = DAILY_CLIENT_CONTROL_TARGET,
}: {
  responses: DailyControlResponse[];
  employeeNames: string[];
  dateKey: string;
  salon: string;
  selectedWorkerName?: string;
  allowedStaffNames?: string[];
  target?: number;
}) {
  const allowedStaff = new Set(
    allowedStaffNames
      .map((name) => resolveCanonicalStaffName(name, employeeNames))
      .filter(Boolean),
  );
  const eligibleResponses = responses.filter((response) => {
    if (!isCompletedAppointment(response.answers ?? {})) return false;
    return salon === "Tutti" || responseSalon(response) === salon;
  });

  const staffPool = new Set<string>(allowedStaff);
  const counts = new Map<string, number>();

  for (const response of eligibleResponses) {
    const names = responseStaff(response, employeeNames)
      .filter((name) => !allowedStaff.size || allowedStaff.has(name));
    for (const name of names) staffPool.add(name);
    if (romeDateKey(response.created_at) !== dateKey) continue;
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  if (selectedWorkerName && (!allowedStaff.size || allowedStaff.has(selectedWorkerName))) {
    staffPool.add(selectedWorkerName);
  }

  const workers: DailyTargetWorker[] = Array.from(staffPool)
    .filter((name) => !selectedWorkerName || name === selectedWorkerName)
    .map((name) => {
      const controls = counts.get(name) ?? 0;
      return {
        name,
        controls,
        remaining: Math.max(target - controls, 0),
        aboveTarget: Math.max(controls - target, 0),
        reachedTarget: controls >= target,
      };
    })
    .sort((a, b) => {
      if (a.reachedTarget !== b.reachedTarget) return a.reachedTarget ? 1 : -1;
      return a.controls - b.controls || a.name.localeCompare(b.name, "it");
    });

  return {
    workers,
    totalControls: workers.reduce((sum, worker) => sum + worker.controls, 0),
    reachedTarget: workers.filter((worker) => worker.reachedTarget).length,
  };
}
