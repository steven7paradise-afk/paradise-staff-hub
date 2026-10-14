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
  source: "VIES + SIBILL" | "VIES" | "SIBILL";
  warning?: string;
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
    ...(conflictingLocation ? { warning: `Indirizzo diverso tra VIES e Sibill. Per la fattura sono stati utilizzati i dati Sibill: ${street}, ${postalCode} ${city} (${province}). Indirizzo VIES: ${vies.address}.` } : {}),
  };
}

export async function lookupVerifiedItalianVatCompany(value: unknown) {
  let vies: Awaited<ReturnType<typeof lookupItalianVatCompany>>;
  try {
    vies = await lookupItalianVatCompany(value);
  } catch (error) {
    if (!(error instanceof ItalianVatLookupError) || error.status === 400) throw error;
    const vat = String(value ?? "").replace(/\D/g, "");
    try {
      const data = await fetchSibillCompany(vat);
      if (clean(data.vat_number).replace(/\D/g, "") !== vat) throw new ItalianVatLookupError("I dati Sibill non corrispondono alla Partita IVA richiesta.", 409);
      const name = clean(data.company_name);
      const street = clean(data.address);
      const postalCode = clean(data.postal_code);
      const city = clean(data.city);
      const province = clean(data.province_code).toUpperCase();
      if (!name || !street || !/^\d{5}$/.test(postalCode) || !city || !/^[A-Z]{2}$/.test(province)) throw new ItalianVatLookupError("Dati aziendali incompleti: completa manualmente ragione sociale e indirizzo.", 422);
      return { name, street, postalCode, city, province, address: `${street}, ${postalCode} ${city} (${province})`, vat, taxNumber: clean(data.tax_number), source: "SIBILL" as const, warning: "Dati recuperati da Sibill. Verifica VIES non completata: controlla i dati prima di fatturare." };
    } catch (fallbackError) {
      if (fallbackError instanceof ItalianVatLookupError && fallbackError.status === 409) throw fallbackError;
      throw new ItalianVatLookupError("Non è stato possibile recuperare i dati aziendali automaticamente. Questo esito non determina la validità della Partita IVA. Puoi compilare manualmente ragione sociale e indirizzo.", 422);
    }
  }
  try {
    return await lookupSibillCompany(vies);
  } catch (error) {
    // Conflicting identities must still be reviewed before invoicing.
    if (error instanceof ItalianVatLookupError && error.status === 409) throw error;
    return { ...vies, taxNumber: "", warning: `Controllo Sibill non completato: ${error instanceof Error ? error.message : "Servizio non disponibile."} Dati anagrafici verificati solo con VIES.` };
  }
}

async function lookupSibillCompany(vies: ItalianVatCompany & { vat: string }) {
  return reconcileVatCompanyData(vies, await fetchSibillCompany(vies.vat));
}

async function fetchSibillCompany(vat: string): Promise<SibillCounterpartSearch> {
  const token = process.env.SIBILL_API_TOKEN?.trim();
  const baseUrl = (process.env.SIBILL_API_BASE_URL?.trim() || DEFAULT_SIBILL_BASE_URL).replace(/\/$/, "");
  if (!token) {
    throw new ItalianVatLookupError("Controllo aziendale Sibill non configurato sul server.", 503);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/counterparts/search?vat_number=${encodeURIComponent(vat)}`, {
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

  return data?.data || {};
}
