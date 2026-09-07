export type ItalianVatCompany = {
  name: string;
  address: string;
  street: string;
  postalCode: string;
  city: string;
  province: string;
};

export class ItalianVatLookupError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ItalianVatLookupError";
  }
}

function clean(value: unknown) {
  return String(value ?? "").replace(/!+/g, " ").replace(/\s+/g, " ").trim();
}

export function hasValidItalianVatChecksum(value: unknown) {
  const vat = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(vat)) return false;

  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    let digit = Number(vat[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(vat[10]);
}

export function normalizeItalianViesCompany(input: { name?: unknown; address?: unknown }): ItalianVatCompany | null {
  const name = clean(input.name);
  const addressLines = String(input.address ?? "")
    .split(/[\r\n]+/)
    .map(clean)
    .filter(Boolean);
  const rawAddress = addressLines.join(", ");
  const locationMatch = rawAddress.match(/^(.*?)[,\s]+(\d{5})\s+(.+?)\s+([A-Z]{2})$/i);

  if (!name || !locationMatch) return null;

  const street = clean(locationMatch[1]).replace(/,+$/, "").trim();
  const postalCode = locationMatch[2];
  const city = clean(locationMatch[3]);
  const province = locationMatch[4].toUpperCase();
  if (!street || !city) return null;

  return {
    name,
    street,
    postalCode,
    city,
    province,
    address: `${street}, ${postalCode} ${city} (${province})`,
  };
}

export async function lookupItalianVatCompany(value: unknown) {
  const vat = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(vat)) {
    throw new ItalianVatLookupError("Partita IVA non valida. Deve essere di 11 cifre.");
  }
  if (!hasValidItalianVatChecksum(vat)) {
    throw new ItalianVatLookupError("Partita IVA non valida: controlla le cifre inserite.");
  }

  let response: Response;
  try {
    response = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/${vat}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ItalianVatLookupError("Il registro europeo VIES non è raggiungibile. Riprova tra poco.", 503);
  }

  if (!response.ok) {
    throw new ItalianVatLookupError("Impossibile contattare il servizio VIES europeo.", response.status);
  }

  const data = await response.json();
  if (!data?.isValid) {
    throw new ItalianVatLookupError(
      "Partita IVA non presente nel registro europeo VIES. Verifica il numero inserito.",
      404,
    );
  }

  const company = normalizeItalianViesCompany(data);
  if (!company) {
    throw new ItalianVatLookupError(
      "Partita IVA valida, ma il registro non ha restituito un indirizzo completo. Completa manualmente via, CAP, città e provincia.",
      422,
    );
  }

  return { ...company, vat, source: "VIES" as const };
}
