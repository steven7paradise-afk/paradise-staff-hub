const DEFAULT_SIBILL_BASE_URL = "https://integration.sibill.com";

export const SIBILL_ANSWER_KEYS = {
  documentId: "sibill_document_id",
  documentStatus: "sibill_document_status",
  documentNumber: "sibill_document_number",
  draftCreatedAt: "sibill_draft_created_at",
} as const;

export type SibillCompany = {
  id: string;
  name: string;
  vat_number: string;
  fiscal_regime: string;
  company_identity?: {
    address?: string | null;
    city?: string | null;
    country?: string | null;
    postal_code?: string | null;
    province_code?: string | null;
  } | null;
};

type BillingAddress = {
  address: string;
  postalCode: string;
  city: string;
  province: string;
};

export class SibillDraftError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "SibillDraftError";
  }
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function digits(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function money(value: number) {
  return value.toFixed(2);
}

export function parseItalianBillingAddress(value: unknown): BillingAddress | null {
  const raw = clean(value).replace(/\s+/g, " ");
  if (!raw) return null;

  // Accept the common formats produced by VIES and Shopify, for example:
  // "Via Roma 10, 20100 Milano (MI)", "Via Roma 10, 20100 Milano, MI"
  // and the historical VIES format "Via Roma 10, 20100 Milano MI".
  const match = raw.match(/^(.*?)[,\s]+(\d{5})\s+(.+?)(?:\s*\(([A-Za-z]{2})\)|\s*,\s*([A-Za-z]{2})|\s+([A-Za-z]{2}))?$/);
  if (!match) return null;

  const address = clean(match[1]).replace(/,+$/, "").trim();
  const postalCode = match[2];
  const city = clean(match[3]).replace(/,+$/, "").trim();
  const province = clean(match[4] || match[5] || match[6]).toUpperCase();
  if (!address || !postalCode || !city) return null;

  return { address, postalCode, city, province };
}

function paymentCode(value: unknown) {
  const normalized = clean(value).toLowerCase();
  if (normalized.includes("contant")) return "MP01";
  if (normalized.includes("bonific")) return "MP05";
  if (normalized.includes("carta") || normalized.includes("bancomat")) return "MP08";
  return "MP01";
}

function invoiceDescription(answers: Record<string, unknown>) {
  const reference = clean(answers.invoice_receipt_ref || answers.invoice_shopify_order);
  const notes = clean(answers.invoice_notes).replace(/\s+/g, " ");
  const base = notes || "Servizi e prodotti Paradise Beauty";
  return `${base}${reference ? ` · Rif. ${reference}` : ""}`.slice(0, 1000);
}

export function buildSibillInvoiceDraft(
  answers: Record<string, unknown>,
  company: SibillCompany,
  date = new Date(),
) {
  const clientType = clean(answers.invoice_client_type);
  const isCompany = clientType.toLowerCase().includes("azienda") || clientType.toLowerCase().includes("professionista");
  const clientName = clean(answers.invoice_client_name);
  const fiscalCode = clean(answers.invoice_fiscal_code).toUpperCase().replace(/\s/g, "");
  const vatNumber = digits(answers.invoice_vat_number);
  const address = parseItalianBillingAddress(answers.invoice_address);
  const grossAmount = Number.parseFloat(clean(answers.invoice_amount).replace(",", "."));

  if (!clientName) throw new SibillDraftError("Completa il nome o la ragione sociale della cliente.");
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    throw new SibillDraftError("Inserisci un importo da fatturare maggiore di zero.");
  }
  if (!address) {
    throw new SibillDraftError("Completa l’indirizzo nel formato: Via e numero, CAP Città (Provincia).");
  }
  if (isCompany && vatNumber.length !== 11) {
    throw new SibillDraftError("La Partita IVA deve contenere 11 cifre.");
  }
  if (!isCompany && !/^[A-Z0-9]{16}$/.test(fiscalCode)) {
    throw new SibillDraftError("Il Codice Fiscale deve contenere 16 caratteri.");
  }

  const sellerVat = digits(company.vat_number);
  const sellerIdentity = company.company_identity;
  if (!company.name || sellerVat.length !== 11 || !company.fiscal_regime || !sellerIdentity?.postal_code) {
    throw new SibillDraftError("I dati fiscali dell’azienda su Sibill non sono completi.", 422);
  }

  const vatRate = 22;
  const netAmount = Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100;
  const vatAmount = Math.round((grossAmount - netAmount) * 100) / 100;
  const invoiceDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
  const requestedDestinationCode = clean(answers.invoice_sdi_code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  // FPR12 accepts exactly seven characters. Old forms sometimes contain notes
  // next to the code: never forward that invalid text to Sibill.
  const destinationCode = isCompany && /^[A-Z0-9]{7}$/.test(requestedDestinationCode)
    ? requestedDestinationCode
    : "0000000";
  const pec = clean(answers.invoice_pec).toLowerCase();

  const customerTaxData: Record<string, unknown> = {
    anagrafica: { denominazione: clientName },
  };
  if (isCompany) {
    customerTaxData.id_fiscale_iva = { id_paese: "IT", id_codice: vatNumber };
    if (fiscalCode) customerTaxData.codice_fiscale = fiscalCode;
  } else {
    customerTaxData.codice_fiscale = fiscalCode;
  }

  return {
    versione: "FPR12",
    namespace: "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2",
    // Sibill accepts at most 10 characters for SistemaEmittente.
    sistema_emittente: "PARADISE",
    fattura_elettronica_header: {
      dati_trasmissione: {
        formato_trasmissione: "FPR12",
        codice_destinatario: destinationCode,
        ...(pec ? { pec_destinatario: pec } : {}),
      },
      cedente_prestatore: {
        dati_anagrafici: {
          id_fiscale_iva: { id_paese: "IT", id_codice: sellerVat },
          anagrafica: { denominazione: company.name },
          regime_fiscale: company.fiscal_regime,
        },
        sede: {
          indirizzo: clean(sellerIdentity.address),
          cap: clean(sellerIdentity.postal_code),
          comune: clean(sellerIdentity.city),
          provincia: clean(sellerIdentity.province_code).toUpperCase(),
          nazione: clean(sellerIdentity.country).toUpperCase() || "IT",
        },
      },
      cessionario_committente: {
        dati_anagrafici: customerTaxData,
        sede: {
          indirizzo: address.address,
          cap: address.postalCode,
          comune: address.city,
          ...(address.province ? { provincia: address.province } : {}),
          nazione: "IT",
        },
      },
    },
    fattura_elettronica_body: [
      {
        dati_generali: {
          dati_generali_documento: {
            tipo_documento: "TD01",
            divisa: "EUR",
            data: invoiceDate,
            importo_totale_documento: money(grossAmount),
          },
        },
        dati_beni_servizi: {
          dettaglio_linee: [
            {
              numero_linea: "1",
              descrizione: invoiceDescription(answers),
              quantita: "1.00",
              prezzo_unitario: money(netAmount),
              prezzo_totale: money(netAmount),
              aliquota_iva: money(vatRate),
            },
          ],
          dati_riepilogo: [
            {
              aliquota_iva: money(vatRate),
              imponibile_importo: money(netAmount),
              imposta: money(vatAmount),
              esigibilita_iva: "I",
            },
          ],
        },
        dati_pagamento: [
          {
            condizioni_pagamento: "TP02",
            dettaglio_pagamento: [
              {
                modalita_pagamento: paymentCode(answers.invoice_payment_method),
                data_scadenza_pagamento: invoiceDate,
                importo_pagamento: money(grossAmount),
              },
            ],
          },
        ],
      },
    ],
  };
}

function sibillConfig() {
  const token = process.env.SIBILL_API_TOKEN?.trim();
  const companyId = process.env.SIBILL_COMPANY_ID?.trim();
  const baseUrl = (process.env.SIBILL_API_BASE_URL?.trim() || DEFAULT_SIBILL_BASE_URL).replace(/\/$/, "");
  if (!token) {
    throw new SibillDraftError("Collegamento Sibill non ancora configurato sul server.", 503);
  }
  return { token, companyId, baseUrl };
}

async function sibillJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function sibillErrorMessage(data: any, fallback: string) {
  const first = Array.isArray(data?.errors) ? data.errors[0] : null;
  return clean(first?.detail || first?.title || data?.error || data?.message) || fallback;
}

async function loadSibillCompany() {
  const config = sibillConfig();
  const response = await fetch(`${config.baseUrl}/api/v1/companies?expand=company_identity`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await sibillJson(response);
  if (!response.ok) {
    throw new SibillDraftError(sibillErrorMessage(data, "Sibill non ha accettato le credenziali configurate."), response.status);
  }

  const companies = Array.isArray(data?.data) ? data.data as SibillCompany[] : [];
  const company = config.companyId
    ? companies.find((item) => item.id === config.companyId)
    : companies.length === 1
      ? companies[0]
      : null;

  if (!company) {
    throw new SibillDraftError(
      companies.length > 1
        ? "Sono presenti più aziende su Sibill: configura l’azienda Paradise corretta."
        : "Azienda Paradise non trovata nell’account Sibill.",
      422,
    );
  }
  return { config, company };
}

export async function createSibillDraft(input: {
  answers: Record<string, unknown>;
  responseId: string;
  createdAt?: Date;
}) {
  const { config, company } = await loadSibillCompany();
  const payload = buildSibillInvoiceDraft(input.answers, company, input.createdAt);
  const reference = clean(input.answers.invoice_receipt_ref || input.answers.invoice_shopify_order) || input.responseId;
  const query = new URLSearchParams({
    issue: "false",
    automatic_number: "true",
    reconciliation_identifier: reference,
  });

  const response = await fetch(`${config.baseUrl}/api/v1/companies/${encodeURIComponent(company.id)}/documents/invoice?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await sibillJson(response);
  if (!response.ok) {
    throw new SibillDraftError(sibillErrorMessage(data, "Sibill non è riuscito a creare la bozza."), response.status);
  }

  const document = Array.isArray(data?.data) ? data.data[0] : data?.data;
  const documentId = clean(document?.id);
  if (!documentId) {
    throw new SibillDraftError("Sibill ha risposto senza l’identificativo della bozza.", 502);
  }

  return {
    id: documentId,
    status: clean(document?.status) || "DRAFT",
    number: clean(document?.number),
    companyId: company.id,
  };
}
