type GooglePrivateKeyOptions = {
  jsonEnvNames?: string[];
  base64EnvNames?: string[];
  keyEnvNames?: string[];
};

function cleanEnvValue(value?: string | null) {
  if (!value) return undefined;
  let cleaned = value.trim();

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned.trim();
}

export function normalizeGooglePrivateKey(value?: string | null): string | undefined {
  let key = cleanEnvValue(value);
  if (!key) return undefined;

  key = key.replace(/\r/g, "").replace(/\\n/g, "\n");

  if (key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key);
      return normalizeGooglePrivateKey(parsed.private_key);
    } catch {
      return undefined;
    }
  }

  if (key.includes("BEGIN PRIVATE KEY")) {
    const body = key
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");

    if (!body) return undefined;

    const lines = body.match(/.{1,64}/g)?.join("\n") || body;
    return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
  }

  return undefined;
}

export function decodeGooglePrivateKeyBase64(value?: string | null): string | undefined {
  const encoded = cleanEnvValue(value)?.replace(/\s+/g, "");
  if (!encoded) return undefined;

  try {
    return normalizeGooglePrivateKey(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
}

export function getGooglePrivateKey(options: GooglePrivateKeyOptions = {}) {
  const jsonEnvNames = options.jsonEnvNames ?? ["GOOGLE_SERVICE_ACCOUNT_JSON"];
  const base64EnvNames = options.base64EnvNames ?? ["GOOGLE_PRIVATE_KEY_BASE64"];
  const keyEnvNames = options.keyEnvNames ?? ["GOOGLE_PRIVATE_KEY"];

  for (const envName of jsonEnvNames) {
    const key = normalizeGooglePrivateKey(process.env[envName]);
    if (key) return key;
  }

  for (const envName of base64EnvNames) {
    const key = decodeGooglePrivateKeyBase64(process.env[envName]);
    if (key) return key;
  }

  for (const envName of keyEnvNames) {
    const key = normalizeGooglePrivateKey(process.env[envName]);
    if (key) return key;
  }

  return undefined;
}
