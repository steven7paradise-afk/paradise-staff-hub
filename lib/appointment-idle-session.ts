export const APPOINTMENT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function appointmentSessionRemainingSeconds(activityAgeMs: unknown): number {
  if (typeof activityAgeMs !== "number" || !Number.isFinite(activityAgeMs) || activityAgeMs < 0) return 0;
  return Math.max(0, Math.floor((APPOINTMENT_IDLE_TIMEOUT_MS - activityAgeMs) / 1000));
}

/** Only real foreground interaction, never polling, extends this deadline. */
export class AppointmentIdleSession {
  private lastActivity: number;
  constructor(now: number) { this.lastActivity = now; }
  age(now: number) { return Math.max(0, now - this.lastActivity); }
  expired(now: number) { return now < this.lastActivity || this.age(now) >= APPOINTMENT_IDLE_TIMEOUT_MS; }
  interact(now: number) {
    if (this.expired(now)) return false;
    this.lastActivity = now;
    return true;
  }
}
