export const chatReactions = ["❤️", "👍", "👎", "😂", "😮", "😢", "🙏", "🔥", "🎉", "✅"] as const;
export type MessageReaction = { emoji: string; count: number; mine: boolean };
export function summarizeReactions(rows: { value: unknown }[], messageId: string, viewer: string, blocked: string[]) {
  const result = new Map<string, MessageReaction>();
  for (const row of rows) {
    const value = row.value as { messageId?: string; userId?: string; emoji?: string } | null;
    if (!value || value.messageId !== messageId || !value.userId || blocked.includes(value.userId) || !chatReactions.includes(value.emoji as typeof chatReactions[number])) continue;
    const item = result.get(value.emoji!) ?? { emoji: value.emoji!, count: 0, mine: false };
    item.count++; item.mine ||= value.userId === viewer; result.set(item.emoji, item);
  }
  return [...result.values()];
}
