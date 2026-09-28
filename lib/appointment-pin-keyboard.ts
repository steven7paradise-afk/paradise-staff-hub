export function appointmentPinKey(event: {
  key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean;
  repeat: boolean; isComposing: boolean;
}): "submit" | "backspace" | "clear" | string | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return null;
  if (/^[0-9]$/.test(event.key)) return event.key;
  if (event.key === "Backspace") return "backspace";
  if (event.key === "Delete") return "clear";
  if (event.key === "Enter") return "submit";
  return null;
}
