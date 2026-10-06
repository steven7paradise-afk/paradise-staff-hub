export const SOCIAL_POST_STATUSES = ["RECORDED", "DRAFT", "PLANNED", "PUBLISHED"] as const;

/** Interpret the editor's date/time in the salon timezone, including DST. */
export function parseSocialSchedule(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const date = new Date(value);
    return Number.isFinite(+date) ? date : null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min, sec = "0"] = match;
  const wallTime = Date.UTC(+y, +m - 1, +d, +h, +min, +sec);
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" });
  const wallAt = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  };
  let instant = wallTime;
  for (let i = 0; i < 3; i++) instant += wallTime - wallAt(instant);
  const result = new Date(instant);
  const expected = `${y}-${m}-${d} ${h}:${min}:${sec.padStart(2, "0")}`;
  return formatter.format(result) === expected ? result : null;
}

export function validateSocialSchedule(status: unknown, date: Date | null, now = new Date()) {
  if (!SOCIAL_POST_STATUSES.includes(status as typeof SOCIAL_POST_STATUSES[number])) return "Stato del contenuto non valido.";
  if (!date) return "Inserisci una data e un orario validi (fuso Europe/Rome).";
  if (status === "PLANNED" && +date <= +now) return "Per programmare il contenuto scegli una data e un orario futuri.";
  return null;
}

/** Only scheduled posts expire. Drafts and recorded content are never advanced. */
export function dueSocialPostsWhere(now = new Date()) {
  return { status: "PLANNED", scheduled_at: { lte: now } };
}
