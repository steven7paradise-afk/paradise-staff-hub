import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatOneDReader, RGBLuminanceSource } from "@zxing/library";

/** Software fallback independent of browser BarcodeDetector and preview CSS size. */
export function createShippingFrameDecoder(target: "TRACKING" | "BARCODE") {
  const formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8];
  if (target === "TRACKING") formats.push(BarcodeFormat.ITF);
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, formats], [DecodeHintType.TRY_HARDER, true]]);
  const reader = new MultiFormatOneDReader(hints);
  const read = (pixels: Uint8ClampedArray, width: number, height: number) => {
    try { return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))), hints).getText(); }
    catch { return null; }
    finally { reader.reset(); }
  };
  return (rgba: Uint8ClampedArray, width: number, height: number): string | null => {
    if (!width || !height || rgba.length !== width * height * 4) return null;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] + 2 * rgba[i * 4 + 1] + rgba[i * 4 + 2]) >> 2;
    const code = read(gray, width, height);
    if (code) return code;
    const rotated = new Uint8ClampedArray(gray.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rotated[x * height + height - 1 - y] = gray[y * width + x];
    return read(rotated, height, width);
  };
}
