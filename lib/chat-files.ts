import { ChatError } from "./chat-policy";
export const MAX_CHAT_FILE = 5 * 1024 * 1024;
export function validateChatFile(name: unknown, encoded: unknown) {
  if (typeof encoded === "string" && encoded.length > Math.ceil(MAX_CHAT_FILE / 3) * 4) throw new ChatError("Massimo 5 MB per allegato.", 413);
  if (typeof name !== "string" || typeof encoded !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new ChatError("Allegato non valido. Massimo 5 MB.");
  const data = Buffer.from(encoded, "base64");
  if (data.length > MAX_CHAT_FILE) throw new ChatError("Massimo 5 MB per allegato.", 413);
  if (!data.length || data.length > MAX_CHAT_FILE || data.toString("base64") !== encoded) throw new ChatError("Allegato non valido.");
  const filename = name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 120);
  let mediaType: string;
  if (/\.pdf$/i.test(filename) && data.subarray(0, 5).toString() === "%PDF-") mediaType = "application/pdf";
  else if (/\.png$/i.test(filename) && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mediaType = "image/png";
  else if (/\.jpe?g$/i.test(filename) && data[0] === 255 && data[1] === 216 && data[2] === 255) mediaType = "image/jpeg";
  else if (/\.txt$/i.test(filename) && !data.includes(0) && Buffer.from(data.toString("utf8")).equals(data)) mediaType = "text/plain";
  else if (/\.m4a$/i.test(filename) && data.length >= 12 && data.subarray(4, 8).toString() === "ftyp") mediaType = "audio/mp4";
  else if (/\.webm$/i.test(filename) && data.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) && data.subarray(0, 4096).includes(Buffer.from("webm"))) mediaType = "audio/webm";
  else if (/\.ogg$/i.test(filename) && data.subarray(0, 4).toString() === "OggS" && data.subarray(0, 4096).includes(Buffer.from("OpusHead"))) mediaType = "audio/ogg";
  else throw new ChatError("Sono supportati PDF, JPEG, PNG, testo e audio M4A, WebM o Ogg validi.");
  return { filename, mediaType, data, size: data.length };
}
export async function boundedJSON(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError("Richiesta vuota.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new ChatError("Richiesta troppo grande.", 413); }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value;
  } catch { throw new ChatError("Richiesta non valida."); }
}
