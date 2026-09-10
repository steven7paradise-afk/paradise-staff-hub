export type AttendanceStateType = "OUT" | "IN" | "BREAK";
export type AttendanceActionType = "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA";

export type AttendanceStateLog<T extends AttendanceActionType = AttendanceActionType> = {
  type: T;
  timestamp: Date | string;
};

export type AttendanceBreakPair<TLog extends AttendanceStateLog = AttendanceStateLog> = {
  pausa: TLog;
  rientro?: TLog;
  minutes?: number;
};

export type AttendanceState<TLog extends AttendanceStateLog = AttendanceStateLog> = {
  status: AttendanceStateType;
  firstEntry?: TLog;
  lastPause?: TLog;
  lastReturn?: TLog;
  lastExit?: TLog;
  activePause?: TLog;
  lastValidLog?: TLog;
  breaks: AttendanceBreakPair<TLog>[];
  invalidLogs: TLog[];
};

function toTime(log: AttendanceStateLog) {
  return new Date(log.timestamp).getTime();
}

export function deriveAttendanceState<TLog extends AttendanceStateLog>(logs: TLog[]): AttendanceState<TLog> {
  const ordered = [...logs]
    .filter((log) => ["ENTRATA", "PAUSA", "RIENTRO", "USCITA"].includes(log.type))
    .filter((log) => !Number.isNaN(toTime(log)))
    .sort((a, b) => toTime(a) - toTime(b));

  const invalidLogs: TLog[] = [];
  const breaks: AttendanceBreakPair<TLog>[] = [];
  let status: AttendanceStateType = "OUT";
  let firstEntry: TLog | undefined;
  let lastPause: TLog | undefined;
  let lastReturn: TLog | undefined;
  let lastExit: TLog | undefined;
  let activePause: TLog | undefined;
  let lastValidLog: TLog | undefined;

  for (const log of ordered) {
    if (log.type === "ENTRATA") {
      if (status !== "OUT") {
        invalidLogs.push(log);
        continue;
      }
      firstEntry ??= log;
      status = "IN";
      lastValidLog = log;
      continue;
    }

    if (log.type === "PAUSA") {
      if (status !== "IN") {
        invalidLogs.push(log);
        continue;
      }
      status = "BREAK";
      activePause = log;
      lastPause = log;
      breaks.push({ pausa: log });
      lastValidLog = log;
      continue;
    }

    if (log.type === "RIENTRO") {
      if (status !== "BREAK" || !activePause || toTime(log) <= toTime(activePause)) {
        invalidLogs.push(log);
        continue;
      }
      const openBreak = breaks[breaks.length - 1];
      if (openBreak && !openBreak.rientro) {
        openBreak.rientro = log;
        openBreak.minutes = Math.max(0, Math.round((toTime(log) - toTime(openBreak.pausa)) / 60_000));
      }
      status = "IN";
      activePause = undefined;
      lastReturn = log;
      lastValidLog = log;
      continue;
    }

    if (log.type === "USCITA") {
      if (status === "OUT") {
        invalidLogs.push(log);
        continue;
      }
      if (status === "BREAK" && activePause) {
        const openBreak = breaks[breaks.length - 1];
        if (openBreak && !openBreak.rientro && toTime(log) > toTime(openBreak.pausa)) {
          openBreak.minutes = Math.max(0, Math.round((toTime(log) - toTime(openBreak.pausa)) / 60_000));
        }
      }
      status = "OUT";
      activePause = undefined;
      lastExit = log;
      lastValidLog = log;
    }
  }

  return {
    status,
    firstEntry,
    lastPause,
    lastReturn,
    lastExit,
    activePause,
    lastValidLog,
    breaks,
    invalidLogs,
  };
}

export function permittedAttendanceActions(status: AttendanceStateType): AttendanceActionType[] {
  if (status === "OUT") return ["ENTRATA"];
  if (status === "BREAK") return ["RIENTRO", "USCITA"];
  return ["PAUSA", "USCITA"];
}

/**
 * Returns the next action for the one-tap NFC flow.
 * The NFC sequence intentionally allows one pause per workday:
 * ENTRATA -> PAUSA -> RIENTRO -> USCITA.
 */
export function nextSequentialAttendanceAction<TLog extends AttendanceStateLog>(
  logs: TLog[],
  fallbackStatus: AttendanceStateType = "OUT",
): AttendanceActionType | null {
  const state = deriveAttendanceState(logs);

  if (state.lastExit) return null;
  if (!state.firstEntry) {
    // Before 06:00 the open shift may belong to the previous calendar day.
    if (logs.length === 0 && fallbackStatus === "BREAK") return "RIENTRO";
    if (logs.length === 0 && fallbackStatus === "IN") return "USCITA";
    return "ENTRATA";
  }
  if (state.status === "BREAK") return "RIENTRO";
  if (state.status === "IN" && state.lastReturn) return "USCITA";
  if (state.status === "IN") return "PAUSA";
  return null;
}
