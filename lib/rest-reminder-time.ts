const ROME_TIME_ZONE = "Europe/Rome";

export function romeCalendarDate(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: ROME_TIME_ZONE }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}

export function isRestReminderTime(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));

  return hour === 15;
}
