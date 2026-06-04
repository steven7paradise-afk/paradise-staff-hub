import type { Prisma } from "@prisma/client";

export type ClockRule = { entranceRoundingMinutes: number; breakDurationMinutes: number };

export function clockRuleKey(locationId: string) {
  return `clock_rule:${locationId}`;
}

export function parseClockRule(value: Prisma.JsonValue | null | undefined): ClockRule {
  if (value && typeof value === "object" && !Array.isArray(value) && "entranceRoundingMinutes" in value) {
    const minutes = Number(value.entranceRoundingMinutes);
    const breakMinutes = Number("breakDurationMinutes" in value ? value.breakDurationMinutes : 60);
    if ([0, 15, 30, 60].includes(minutes) && [15, 30, 45, 60, 90, 120].includes(breakMinutes)) {
      return { entranceRoundingMinutes: minutes, breakDurationMinutes: breakMinutes };
    }
  }
  return { entranceRoundingMinutes: 0, breakDurationMinutes: 60 };
}

export function applyEntranceRounding(timestamp: Date, minutes: number) {
  if (!minutes) return timestamp;
  const interval = minutes * 60 * 1000;
  return new Date(Math.ceil(timestamp.getTime() / interval) * interval);
}

export function applyExitRounding(timestamp: Date, minutes: number) {
  if (!minutes) return timestamp;
  const interval = minutes * 60 * 1000;
  return new Date(Math.floor(timestamp.getTime() / interval) * interval);
}
