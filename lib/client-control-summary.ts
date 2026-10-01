/** Flatten the existing note, without inventing services or changing its contents. */
export function clientControlParagraph(note: string) {
  return note.split(/[•\n\r]+/).map(part => part.trim()).filter(Boolean).join(". ")
    .replace(/\s+/g, " ").replace(/([.!?])\s*\./g, "$1").trim();
}

export function clientControlServiceSentence(details: {
  services?: string[];
  grammi?: string;
  lunghezza?: string;
  fasce?: string;
  atteggiamento?: string;
  extraNote?: string;
}) {
  const join = (parts: string[]) => parts.length < 2 ? (parts[0] || "") : `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
  const unit = (value: string | undefined, suffix: string) => {
    const clean = (value || "").trim();
    if (!clean || clean === "custom") return "";
    return /^\d+(?:[.,]\d+)?$/.test(clean) ? `${clean} ${suffix}` : clean.replace(/(\d)\s*(g|cm)$/i, "$1 $2");
  };
  const services = [...new Set((details.services || []).map(value => value.trim()).filter(Boolean))];
  const grams = unit(details.grammi, "g");
  const length = unit(details.lunghezza, "cm");
  const bands = (details.fasce || "").trim();
  const specifications = [grams, length ? `lunghezza ${length}` : "", bands && bands !== "custom" ? `${bands} ${bands === "1" ? "fascia" : "fasce"}` : ""].filter(Boolean);
  let text = services.length ? `Servizi: ${join(services)}` : "";
  if (specifications.length) text += text ? ` con ${join(specifications)}` : `Dettagli del servizio: ${join(specifications)}`;
  if (text) text += ".";
  if (details.atteggiamento?.trim()) text += ` La cliente è ${details.atteggiamento.trim().toLocaleLowerCase("it-IT")}.`;
  if (details.extraNote?.trim()) text += `${text ? " " : ""}${details.extraNote.trim()}`;
  return clientControlParagraph(text);
}
