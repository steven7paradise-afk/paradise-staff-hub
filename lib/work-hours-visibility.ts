type MonthlyWorker = {
  id: string;
  active: boolean;
};

type AttendanceEvidence = {
  user_id: string;
};

type HoursEvidence = {
  user_id: string;
  hours: number;
};

export function monthlyWorkedUserIds(
  attendanceLogs: AttendanceEvidence[],
  hourRecords: HoursEvidence[],
) {
  const workedUserIds = new Set(attendanceLogs.map((log) => log.user_id));

  hourRecords.forEach((record) => {
    if (Number(record.hours) > 0) workedUserIds.add(record.user_id);
  });

  return Array.from(workedUserIds).sort();
}

export function visibleWorkHoursWorkers<T extends MonthlyWorker>(
  workers: T[],
  workedUserIds: Iterable<string>,
) {
  const worked = new Set(workedUserIds);
  return workers.filter((worker) => worker.active || worked.has(worker.id));
}
