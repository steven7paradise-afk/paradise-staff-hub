function normalizedEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function differsByOneEditOrSwap(a: string, b: string) {
  if (a === b) return true;

  if (a.length === b.length) {
    const differences: number[] = [];
    for (let index = 0; index < a.length; index += 1) {
      if (a[index] !== b[index]) differences.push(index);
      if (differences.length > 2) return false;
    }
    if (differences.length === 1) return true;
    if (differences.length === 2) {
      const [first, second] = differences;
      return second === first + 1 && a[first] === b[second] && a[second] === b[first];
    }
    return false;
  }

  if (Math.abs(a.length - b.length) !== 1) return false;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    longIndex += 1;
  }
  return true;
}

/**
 * Accetta un solo errore comune di battitura nell'indirizzo. Una delle due
 * parti dell'email deve comunque coincidere esattamente, per non collegare
 * clienti diverse.
 */
export function isLikelySameCustomerEmail(first?: string | null, second?: string | null) {
  const a = normalizedEmail(first);
  const b = normalizedEmail(second);
  if (!a || !b) return false;
  if (a === b) return true;

  const [aLocal, aDomain, ...aExtra] = a.split("@");
  const [bLocal, bDomain, ...bExtra] = b.split("@");
  if (!aLocal || !aDomain || aExtra.length || !bLocal || !bDomain || bExtra.length) return false;

  if (aDomain === bDomain) return differsByOneEditOrSwap(aLocal, bLocal);
  if (aLocal === bLocal) return differsByOneEditOrSwap(aDomain, bDomain);
  return false;
}
