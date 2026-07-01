function comparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function isAllUppercase(value: string) {
  const letters = value.replace(/[^A-Za-zÀ-ÿ]+/g, "");
  return Boolean(letters) && letters === letters.toUpperCase();
}

function prettinessScore(value: string) {
  return (isAllUppercase(value) ? 0 : 5) + value.trim().length;
}

function tokenPair(value: string) {
  const tokens = comparable(value).split(" ").filter(Boolean);
  return {
    first: tokens[0] ?? "",
    last: tokens[tokens.length - 1] ?? "",
    joined: tokens.join(" "),
  };
}

export function areLikelySameStaffName(a: string, b: string) {
  const left = tokenPair(a);
  const right = tokenPair(b);
  if (!left.joined || !right.joined) return false;
  if (left.joined === right.joined) return true;
  if (levenshtein(left.joined, right.joined) <= 2) return true;
  if (left.first && left.first === right.first && left.last && right.last && levenshtein(left.last, right.last) <= 2) return true;
  if (left.first && right.first && levenshtein(left.first, right.first) <= 1 && left.last && right.last && levenshtein(left.last, right.last) <= 2) return true;
  return false;
}

export function resolveCanonicalStaffName(name: string, knownNames: string[] = []) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";

  const exact = knownNames.find((candidate) => comparable(candidate) === comparable(trimmed));
  if (exact) return exact;

  const fuzzyCandidates = knownNames.filter((candidate) => areLikelySameStaffName(candidate, trimmed));
  if (!fuzzyCandidates.length) return trimmed;

  return [...fuzzyCandidates].sort((a, b) => {
    const distanceDelta = levenshtein(tokenPair(a).joined, tokenPair(trimmed).joined) - levenshtein(tokenPair(b).joined, tokenPair(trimmed).joined);
    if (distanceDelta !== 0) return distanceDelta;
    return prettinessScore(b) - prettinessScore(a);
  })[0];
}

