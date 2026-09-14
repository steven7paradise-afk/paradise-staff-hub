export type TeamBonusWorker = {
  name: string;
  role: string;
  location: string;
  days: number;
  scheduledDays: number;
  hours: number;
  clients: number;
  photos: number;
  products: number;
  reviews: number;
  lateDays: number;
  lateMinutes: number;
  lateReturns: number;
  lateReturnMinutes: number;
  unjustifiedAbsences: number;
  completedTasks: number;
};

export type TeamBonusResult = TeamBonusWorker & {
  score: number;
  comparable: boolean;
  status: "BONUS_CONSIGLIATO" | "DA_VALUTARE" | "NON_PRIORITARIO" | "DATI_INSUFFICIENTI";
};

export type TeamBonusReport = {
  month: number;
  year: number;
  monthLabel: string;
  salon: string;
  generatedAt: string;
  workers: TeamBonusResult[];
};

function percentage(value: number, total: number) {
  return total > 0 ? value / total * 100 : 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function scoreTeamBonusWorkers(workers: TeamBonusWorker[]): TeamBonusResult[] {
  const candidates = workers.filter((worker) => worker.clients >= 3 && worker.days >= 3 && !worker.role.toLowerCase().includes("reception"));
  const maxClients = Math.max(1, ...candidates.map((worker) => worker.clients));
  const maxTasks = Math.max(1, ...candidates.map((worker) => worker.completedTasks));

  return workers.map((worker) => {
    const scheduledDays = Math.max(1, worker.scheduledDays);
    const attendanceScore = clamp(
      100
      - percentage(worker.lateDays, scheduledDays) * 0.5
      - percentage(worker.lateReturns, scheduledDays) * 0.25
      - percentage(worker.unjustifiedAbsences, scheduledDays),
    );
    const comparable = worker.clients >= 3 && worker.days >= 3 && !worker.role.toLowerCase().includes("reception");
    const score = Math.round((
      attendanceScore * 0.30
      + percentage(worker.photos, worker.clients) * 0.25
      + percentage(worker.products, worker.clients) * 0.20
      + percentage(worker.clients, maxClients) * 0.15
      + percentage(worker.reviews, worker.clients) * 0.05
      + percentage(worker.completedTasks, maxTasks) * 0.05
    ) * 10) / 10;
    const status: TeamBonusResult["status"] = !comparable
      ? "DATI_INSUFFICIENTI"
      : score >= 70
        ? "BONUS_CONSIGLIATO"
        : score >= 60
          ? "DA_VALUTARE"
          : "NON_PRIORITARIO";

    return { ...worker, score, comparable, status };
  }).sort((left, right) => Number(right.comparable) - Number(left.comparable) || right.score - left.score || left.name.localeCompare(right.name));
}

export function previousPayrollMonth(now: Date) {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { monthIndex: previous.getMonth(), year: previous.getFullYear() };
}
