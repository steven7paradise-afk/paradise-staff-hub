export const SHIFT_NOTE_LIMIT = 5000;
// Thirty staff notes, including worst-case JSON escaping and identity metadata.
export const SHIFT_ANSWER_PAYLOAD_LIMIT = 1_000_000;

export function isValidShiftNote(value: string) {
  return value.trim().length > 0 && value.length <= SHIFT_NOTE_LIMIT;
}
