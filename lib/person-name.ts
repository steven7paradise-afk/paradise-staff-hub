export function formatPersonName(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("it-IT")
    .replace(/(^|[\s'’\-])(\p{L})/gu, (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase("it-IT")}`
    );
}
