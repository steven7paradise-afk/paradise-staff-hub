export type ShiftPreviewPerson = { name: string; vice: boolean; category: string; start: string | null; end: string | null };
export type ShiftResponsiblePreview = { day: string; name: string | null; detail: string; people: ShiftPreviewPerson[] };
export function previewShiftResponsible(day: string, people: ShiftPreviewPerson[]): ShiftResponsiblePreview {
  const heads = people.filter(p => !p.vice);
  const working = (p: ShiftPreviewPerson) => /^lavoro$/i.test(p.category) && Boolean(p.start && p.end);
  const head = heads.find(working);
  if (head) return { day, name: head.name, detail: "Responsabile previsto · da confermare con la timbratura", people };
  if (heads.length && heads.every(p => /riposo/i.test(p.category))) {
    const deputy = people.find(p => p.vice && working(p));
    if (deputy) return { day, name: deputy.name, detail: "Subentro del vice · responsabile di riposo", people };
  }
  return { day, name: null, detail: heads.some(p => /formazione/i.test(p.category)) ? "Responsabile in formazione: subentro da definire" : "Assegnazione da verificare con la turnistica", people };
}
