import { ItalianVatCompany, ItalianVatLookupError, lookupItalianVatCompany } from "@/lib/italian-vat-lookup";

const DEFAULT_SIBILL_BASE_URL = "https://integration.sibill.com";

type SibillCounterpartSearch = {
  address?: unknown;
  city?: unknown;
  company_name?: unknown;
  country?: unknown;
  postal_code?: unknown;
  province_code?: unknown;
  tax_number?: unknown;
  vat_number?: unknown;
};

export type VerifiedVatCompany = ItalianVatCompany & {
  vat: string;
  taxNumber: string;
  source: "VIES + SIBILL";
};

function clean(value: unknown) {
  return String(value ?? "").replace(/!+/g, " ").replace(/\s+/g, " ").trim();
}

function comparable(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function nameSimilarity(left: unknown, right: unknown) {
  const leftTokens = new Set(comparable(left).split(" ").filter(Boolean));
  const rightTokens = new Set(comparable(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return common / Math.min(leftTokens.size, rightTokens.size);
}

export function reconcileVatCompanyData(
  vies: ItalianVatCompany & { vat: string },
  sibill: SibillCounterpartSearch,
): VerifiedVatCompany {
  const sibillVat = clean(sibill.vat_number).replace(/\D/g, "");
  const sibillName = clean(sibill.company_name);
  const sibillStreet = clean(sibill.address);
  const sibillPostalCode = clean(sibill.postal_code).replace(/\D/g, "");
  const sibillCity = clean(sibill.city);
  const sibillProvince = clean(sibill.province_code).toUpperCase();

  if (sibillVat !== vies.vat) {
    throw new ItalianVatLookupError("I dati Sibill non corrispondono alla Partita IVA verificata da VIES.", 409);
  }
  if (!sibillName) {
    throw new ItalianVatLookupError("Sibill non ha restituito la ragione sociale dell’azienda.", 422);
  }
  if (nameSimilarity(vies.name, sibillName) < 0.6) {
    throw new ItalianVatLookupError(
      `Ragione sociale diversa tra VIES (${vies.name}) e Sibill (${sibillName}). Controlla prima di fatturare.`,
      409,
    );
  }

  const conflictingLocation = [
    [vies.postalCode, sibillPostalCode],
    [vies.city, sibillCity],
    [vies.province, sibillProvince],
  ].some(([viesValue, sibillValue]) =>
    clean(sibillValue) && comparable(viesValue) !== comparable(sibillValue)
  );
  if (conflictingLocation) {
    throw new ItalianVatLookupError(
      "Sede aziendale diversa tra VIES e Sibill. Controlla CAP, città e provincia prima di fatturare.",
      409,
    );
  }

  const street = sibillStreet || vies.street;
  const postalCode = sibillPostalCode || vies.postalCode;
  const city = sibillCity || vies.city;
  const province = sibillProvince || vies.province;
  if (!street || !postalCode || !city || !province) {
    throw new ItalianVatLookupError("Sibill non ha restituito un indirizzo aziendale completo.", 422);
  }

  return {
    name: sibillName,
    street,
    postalCode,
    city,
    province,
    address: `${street}, ${postalCode} ${city} (${province})`,
    vat: vies.vat,
    taxNumber: clean(sibill.tax_number).toUpperCase(),
    source: "VIES + SIBILL",
  };
}

export async function lookupVerifiedItalianVatCompany(value: unknown) {
  const vies = await lookupItalianVatCompany(value);
  const token = process.env.SIBILL_API_TOKEN?.trim();
  const baseUrl = (process.env.SIBILL_API_BASE_URL?.trim() || DEFAULT_SIBILL_BASE_URL).replace(/\/$/, "");
  if (!token) {
    throw new ItalianVatLookupError("Controllo aziendale Sibill non configurato sul server.", 503);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/counterparts/search?vat_number=${encodeURIComponent(vies.vat)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ItalianVatLookupError("Il controllo aziendale Sibill non è raggiungibile. Riprova tra poco.", 503);
  }

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const detail = Array.isArray(data?.errors) ? data.errors[0]?.detail : data?.message;
    throw new ItalianVatLookupError(
      clean(detail) || "Sibill non ha trovato i dati associati a questa Partita IVA.",
      response.status,
    );
  }

  return reconcileVatCompanyData(vies, data?.data || {});
}
