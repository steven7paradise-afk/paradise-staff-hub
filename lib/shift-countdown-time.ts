/** Resolve a salon time against an explicit clock snapshot, independent of the host timezone. */
export function shiftCountdownTarget(time: string | null, now: Date): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const wallTime = Date.parse(`${day}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
  let instant = wallTime;
  for (let i = 0; i < 2; i++) {
    const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", timeZoneName: "shortOffset" })
      .formatToParts(new Date(instant)).find(part => part.type === "timeZoneName")?.value;
    const match = offset?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const offsetMinutes = match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
    instant = wallTime - offsetMinutes * 60000;
  }
  return new Date(instant);
}
