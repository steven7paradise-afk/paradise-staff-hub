type Checks = {
  beforeMedia: boolean;
  afterMedia: boolean;
  products: boolean;
  review: boolean;
};

const labels = [
  ["beforeMedia", "Prima foto/video"],
  ["afterMedia", "Dopo foto/video"],
  ["products", "Prodotti"],
  ["review", "Recensione"],
] as const;

/** Replace only our generated trailing block when editing a legacy receipt. */
export function appendClientControlChecks(note: string, checks: Checks): string {
  const base = note.trim().replace(
    /(?:\n\n|^)-----------------------\nVERIFICHE E CONTROLLI\n(?:(?:Prima foto\/video|Dopo foto\/video|Prodotti|Recensione): Sì\n?)+$/u,
    "",
  ).trim();
  const selected = labels.filter(([key]) => checks[key]).map(([, label]) => `${label}: Sì`);
  return [base, selected.length ? ["-----------------------", "VERIFICHE E CONTROLLI", ...selected].join("\n") : ""].filter(Boolean).join("\n\n");
}
