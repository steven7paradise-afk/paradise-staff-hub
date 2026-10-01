/** Await every destination and report partial failures instead of hiding them. */
export async function syncClientControlNotes(
  orders: string[],
  writeNote: (order: string) => Promise<boolean>,
  writeFields: (order: string) => Promise<boolean>,
) {
  const succeeded: string[] = [];
  const failed: string[] = [];
  for (const order of new Set(orders)) {
    try {
      const noteSaved = await writeNote(order);
      const fieldsSaved = noteSaved && await writeFields(order);
      (noteSaved && fieldsSaved ? succeeded : failed).push(order);
    } catch {
      failed.push(order);
    }
  }
  return { succeeded, failed };
}
