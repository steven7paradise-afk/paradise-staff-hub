/** Bound HTTP probe latency without accumulating queries when the pool stalls. */
export function createDatabaseHealthCheck(
  query: () => Promise<unknown>,
  { timeoutMs = 3000, cacheMs = 5000 } = {},
) {
  let inFlight: Promise<boolean> | undefined;
  let cached: { healthy: boolean; until: number } | undefined;

  return async (): Promise<boolean> => {
    if (cached && Date.now() < cached.until) return cached.healthy;

    if (!inFlight) {
      // Promise.resolve also catches synchronous failures in the query factory.
      inFlight = Promise.resolve().then(query).then(
        () => true,
        () => false,
      ).then((healthy) => {
        cached = { healthy, until: Date.now() + cacheMs };
        inFlight = undefined;
        return healthy;
      });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        inFlight,
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => {
            cached = { healthy: false, until: Date.now() + cacheMs };
            resolve(false);
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      // A timeout does not cancel Prisma. Keep its pending query shared until
      // it settles; the supervisor replaces the process if it stays wedged.
    }
  };
}
