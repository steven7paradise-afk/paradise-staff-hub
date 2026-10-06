import type { AssistanceSheet } from "@/lib/assistance-tables";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function nameKey(value: string) { return normalized(value).split(" ").sort().join(" "); }

/** Uses the row's insertion month, not updatedAt: editing must not move a charge to a new month. */
export function resultBonusTableOccurrences(sheets: AssistanceSheet[], month: string, people: Array<{ id: string; name: string }>, options: { includeUnreviewed?: boolean; staffColumn?: "previous" | "performed" } = {}) {
  const matches: Array<{ id: string; userId: string; date: string; reference: string }> = [];
  const seen = new Set<string>();
  for (const sheet of sheets) {
    if (!/^sistemazione fasc(?:e|ie)$/.test(normalized(sheet.name))) continue;
    const previous = sheet.columns.find((column) => (options.staffColumn === "performed" ? /^sistemazione$/ : /^app(?:untamento)? precedente$/).test(normalized(column.label)));
    const order = sheet.columns.find((column) => /^(numero )?ordine( shopify)?$/.test(normalized(column.label)));
    if (!previous) continue;
    for (const row of sheet.rows) {
      // Automatic attribution is not approval: only reviewed rows affect the bonus.
      if (!options.includeUnreviewed && (!row.reviewedAt || !Number.isFinite(new Date(row.reviewedAt).getTime()))) continue;
      const time = new Date(row.createdAt);
      if (!row.id || !Number.isFinite(time.getTime())) continue;
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(time);
      if (!date.startsWith(`${month}-`)) continue;
      const value = row.values[previous.id];
      if (typeof value !== "string") continue;
      const explicitNames = value.split(/[,;\n/]+/).map((part) => part.trim()).filter(Boolean);
      // Imported historical cells can contain notes. Only read explicit Staff: lists,
      // never other names mentioned in the narrative or guessed nicknames.
      for (const segment of value.split(/staff\s*:/i).slice(1)) {
        let remainder = normalized(segment);
        while (remainder) {
          const candidates = people.filter((person) => remainder === normalized(person.name) || remainder.startsWith(`${normalized(person.name)} `));
          if (candidates.length !== 1) break;
          const candidate = candidates[0];
          explicitNames.push(candidate.name);
          remainder = remainder.slice(normalized(candidate.name).length).trim().replace(/^e\s+/, "");
        }
      }
      for (const name of explicitNames) {
        // Never guess ambiguous or approximate names when a value can reduce pay.
        const candidates = people.filter((person) => nameKey(person.name) === nameKey(name));
        if (candidates.length !== 1) continue;
        const userId = candidates[0].id;
        const id = `table-previous:${row.id}:${userId}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const orderValue = order ? row.values[order.id] : null;
        matches.push({ id, userId, date, reference: typeof orderValue === "string" && orderValue.trim() ? `Ordine ${orderValue.trim()}` : `Riga ${row.id}` });
      }
    }
  }
  return matches;
}
