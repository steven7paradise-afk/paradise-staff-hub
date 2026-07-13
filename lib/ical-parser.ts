export type IcalEvent = {
  uid: string;
  summary: string;
  description: string;
  startDate: Date;
  endDate: Date;
};

export function parseIcal(icalText: string): IcalEvent[] {
  const lines: string[] = [];
  const rawLines = icalText.split(/\r?\n/);
  
  // Unfold lines (standard iCal formatting where wrapped lines start with a space or tab)
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }

  const events: IcalEvent[] = [];
  let currentEvent: any = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (trimmed === "END:VEVENT") {
      if (currentEvent && currentEvent.dtstart && currentEvent.dtend) {
        events.push({
          uid: currentEvent.uid || Math.random().toString(),
          summary: currentEvent.summary || "Senza Titolo",
          description: currentEvent.description || "",
          startDate: parseIcalDate(currentEvent.dtstart, currentEvent.dtstartTzid),
          endDate: parseIcalDate(currentEvent.dtend, currentEvent.dtendTzid),
        });
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx !== -1) {
        const keyPart = trimmed.slice(0, colonIdx);
        const value = trimmed.slice(colonIdx + 1).replace(/\\,/g, ",").replace(/\\n/g, "\n");
        
        const semicolonIdx = keyPart.indexOf(";");
        const key = (semicolonIdx !== -1 ? keyPart.slice(0, semicolonIdx) : keyPart).toUpperCase();
        const params = semicolonIdx !== -1 ? keyPart.slice(semicolonIdx + 1) : "";

        if (key === "UID") {
          currentEvent.uid = value;
        } else if (key === "SUMMARY") {
          currentEvent.summary = value;
        } else if (key === "DESCRIPTION") {
          currentEvent.description = value;
        } else if (key === "DTSTART") {
          currentEvent.dtstart = value;
          const tzidMatch = params.match(/TZID=([^;]+)/i);
          if (tzidMatch) currentEvent.dtstartTzid = tzidMatch[1];
        } else if (key === "DTEND") {
          currentEvent.dtend = value;
          const tzidMatch = params.match(/TZID=([^;]+)/i);
          if (tzidMatch) currentEvent.dtendTzid = tzidMatch[1];
        }
      }
    }
  }

  return events;
}

function parseIcalDate(dateStr: string, tzid?: string): Date {
  const clean = dateStr.replace(/[^0-9TZ]/g, "");
  const year = parseInt(clean.slice(0, 4), 10);
  const month = parseInt(clean.slice(4, 6), 10) - 1;
  const day = parseInt(clean.slice(6, 8), 10);
  const hour = parseInt(clean.slice(9, 11), 10);
  const minute = parseInt(clean.slice(11, 13), 10);
  const second = parseInt(clean.slice(13, 15), 10) || 0;

  const isUtc = clean.endsWith("Z");

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  // Fallback / local time
  return new Date(year, month, day, hour, minute, second);
}
