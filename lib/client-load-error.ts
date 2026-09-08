const RECOVERABLE_CLIENT_LOAD_PATTERNS = [
  /loading chunk \d+ failed/i,
  /chunkloaderror/i,
  /failed to fetch dynamically imported module/i,
  /minified react error #412/i,
  /connection closed/i,
];

export function isRecoverableClientLoadError(message: string) {
  return RECOVERABLE_CLIENT_LOAD_PATTERNS.some((pattern) => pattern.test(message));
}
