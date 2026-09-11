import { deriveAttendanceState, type AttendanceStateLog } from "@/lib/attendance-state";

const DEFAULT_SHIFT_MILLISECONDS = 8 * 60 * 60 * 1000;

export function forgottenShiftExitTime<TLog extends AttendanceStateLog>(logs: TLog[]) {
  const state = deriveAttendanceState(logs);
  if (state.status === "OUT" || !state.firstEntry) return null;

  const entryTime = new Date(state.firstEntry.timestamp).getTime();
  const lastValidTime = state.lastValidLog
    ? new Date(state.lastValidLog.timestamp).getTime()
    : entryTime;
  if (!Number.isFinite(entryTime) || !Number.isFinite(lastValidTime)) return null;

  // Default to eight hours from entry, but never create an exit before the
  // latest valid action in an unusually long shift.
  return new Date(Math.max(entryTime + DEFAULT_SHIFT_MILLISECONDS, lastValidTime));
}
