import type { AttendanceType } from "@prisma/client";

type AttendancePoint = { type: AttendanceType; timestamp: Date };

export type ClockHours = {
  grossHours: number;
  breakHours: number;
  netHours: number;
  firstEntry: string | null;
  lastExit: string | null;
};

function roundedHours(milliseconds: number) {
  return Math.round((milliseconds / 3_600_000) * 100) / 100;
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(date);
}

export function calculateClockHours(logs: AttendancePoint[]): ClockHours {
  const ordered = [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let enteredAt: Date | null = null;
  let breakAt: Date | null = null;
  let grossMilliseconds = 0;
  let breakMilliseconds = 0;
  let firstEntry: Date | null = null;
  let lastExit: Date | null = null;

  ordered.forEach((log) => {
    if (log.type === "ENTRATA") {
      enteredAt = log.timestamp;
      breakAt = null;
      firstEntry ??= log.timestamp;
    }
    if (log.type === "PAUSA" && enteredAt) {
      breakAt = log.timestamp;
    }
    if (log.type === "RIENTRO" && breakAt) {
      breakMilliseconds += log.timestamp.getTime() - breakAt.getTime();
      breakAt = null;
    }
    if (log.type === "USCITA" && enteredAt) {
      if (breakAt) {
        breakMilliseconds += log.timestamp.getTime() - breakAt.getTime();
        breakAt = null;
      }
      grossMilliseconds += log.timestamp.getTime() - enteredAt.getTime();
      lastExit = log.timestamp;
      enteredAt = null;
    }
  });

  return {
    grossHours: roundedHours(grossMilliseconds),
    breakHours: roundedHours(breakMilliseconds),
    netHours: roundedHours(Math.max(0, grossMilliseconds - breakMilliseconds)),
    firstEntry: firstEntry ? timeLabel(firstEntry) : null,
    lastExit: lastExit ? timeLabel(lastExit) : null,
  };
}
