function normalizedFirstName(value: string) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)[0]
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it-IT") ?? "";
}

function compactDuplicateName(value: string) {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toLocaleUpperCase("it-IT")}.`;
}

export function formatShopifyStaffNames(
  selectedNames: string[],
  knownStaffNames: string[],
) {
  const firstNameCounts = new Map<string, number>();
  for (const name of new Set(knownStaffNames.map((value) => String(value ?? "").trim()).filter(Boolean))) {
    const firstName = normalizedFirstName(name);
    if (firstName) {
      firstNameCounts.set(firstName, (firstNameCounts.get(firstName) ?? 0) + 1);
    }
  }

  return selectedNames
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((name) =>
      (firstNameCounts.get(normalizedFirstName(name)) ?? 0) > 1
        ? compactDuplicateName(name)
        : name,
    );
}
