export type AttendanceBreakLog = {
  type: string;
  timestamp: Date;
  note?: string | null;
};

export type AttendanceBreakSummary = {
  lateCount: number;
  lateMinutes: number;
};

const MANUAL_ATTENDANCE_CHANGE = /(?:Modificata|Inserita) manualmente da Admin/i;
const BREAK_DELAY_GRACE_MINUTES = 1;

export function attendanceReportDayKeys(
  scheduledDates: Date[],
  loggedDates: Date[],
) {
  return [...new Set([...scheduledDates, ...loggedDates].map((date) => date.toISOString().slice(0, 10)))].sort();
}

/**
 * Counts late returns from paired PAUSA/RIENTRO logs.
 *
 * The attendance calendar displays completed pause durations rounded to the
 * nearest minute. The report gives exactly sixty seconds of tolerance beyond
 * the configured limit: a pause up to 60:59 is valid, while 61:00 is late.
 * Any pair touched by an administrator is considered corrected and is not
 * counted as a late return.
 */
export function summarizeLateBreakReturns(
  logs: AttendanceBreakLog[],
  fallbackLimitMinutes: number,
): AttendanceBreakSummary {
  const ordered = [...logs].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  let pausedAt: AttendanceBreakLog | null = null;
  let lateCount = 0;
  let lateMinutes = 0;

  for (const log of ordered) {
    if (log.type === "PAUSA") {
      pausedAt = log;
      continue;
    }

    if (log.type === "RIENTRO" && pausedAt) {
      const rawDurationMinutes = Math.max(0, (log.timestamp.getTime() - pausedAt.timestamp.getTime()) / 60_000);
      const isManualChange = MANUAL_ATTENDANCE_CHANGE.test(pausedAt.note ?? "")
        || MANUAL_ATTENDANCE_CHANGE.test(log.note ?? "");
      const rawDelayMinutes = Math.max(0, rawDurationMinutes - fallbackLimitMinutes);
      const delayMinutes = isManualChange || rawDelayMinutes < BREAK_DELAY_GRACE_MINUTES
        ? 0
        : Math.ceil(rawDelayMinutes);

      if (delayMinutes > 0) {
        lateCount += 1;
        lateMinutes += delayMinutes;
      }
      pausedAt = null;
      continue;
    }

    if ((log.type === "ENTRATA" || log.type === "USCITA") && pausedAt) {
      pausedAt = null;
    }
  }

  return { lateCount, lateMinutes };
}
