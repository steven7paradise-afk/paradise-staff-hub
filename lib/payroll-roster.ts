
export type PayrollWorker = {
  id: string; name: string; active?: boolean; role?: string; mansione?: string | null;
  location?: { id: string; name: string } | null;
  photo_url?: string | null; email?: string | null;
  contractStart?: string | null; contractEnd?: string | null; workedMonths?: string[];
};
type PayrollDocument = {
  id: string; type: string; month: number | null; year: number | null; created_at: string;
  user: { id: string; name: string; email?: string; photo_url?: string | null };
};

// Attendance determines the delivery reminder, never who can be found in the archive.
export function buildPayrollRoster(workers: PayrollWorker[], documents: PayrollDocument[], month: number, year: number) {
  const people = new Map(workers.map(worker => [worker.id, worker]));
  for (const doc of documents) {
    if (!people.has(doc.user.id)) people.set(doc.user.id, { ...doc.user, active: false });
  }
  return Array.from(people.values()).map(worker => {
    const files = documents.filter(doc => doc.user.id === worker.id);
    const payslips = files.filter(doc => doc.type === "BUSTA_PAGA" && doc.month === month && doc.year === year)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { ...worker, filesCount: files.length, payslips,
      status: payslips.length ? "uploaded" : worker.active !== false ? "missing" : "inactive" };
  }).sort((a, b) => a.name.localeCompare(b.name, "it"));
}
