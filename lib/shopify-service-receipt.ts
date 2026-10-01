/** Replace only exact receipts owned by this appointment; leave other order notes intact. */
export function mergeShopifyServiceReceipt(current: string, receipt: string, previousReceipts: string[]) {
  let remaining = current.trim();
  for (const previous of [...new Set([...previousReceipts, receipt])].filter(Boolean).sort((a, b) => b.length - a.length)) {
    // Boundary matching prevents deleting a matching phrase inside a human note.
    const escaped = previous.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remaining = remaining.replace(new RegExp(`(^|\\n\\n)${escaped}(?=\\n\\n|$)`, "g"), "$1");
  }
  return [remaining.replace(/\n{3,}/g, "\n\n").trim(), receipt.trim()].filter(Boolean).join("\n\n");
}
