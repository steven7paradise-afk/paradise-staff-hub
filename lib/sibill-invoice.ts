import { enrichCompanyInvoiceIdentity, enrichInvoiceAnswersFromShopify } from "@/lib/invoice-shopify";

const DEFAULT_SIBILL_BASE_URL = "https://integration.sibill.com";

export const SIBILL_ANSWER_KEYS = {
  documentId: "sibill_document_id",
  documentStatus: "sibill_document_status",
  documentNumber: "sibill_document_number",
  paymentStatus: "sibill_payment_status",
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

type SibillAccount = {
  id: string;
  nickname?: string | null;
  currency?: string | null;
  current_balance?: {
    amount?: string | number | null;
    currency?: string | null;
  } | null;
  available_balance?: {
    amount?: string | number | null;
    currency?: string | null;
  } | null;
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
  const notes = clean(answers.invoice_notes).replace(/\s+/g, " ");
  return (notes || "Servizi e prodotti Paradise Beauty").slice(0, 1000);
}

function shopifyOrderDescription(answers: Record<string, unknown>) {
  const value = clean(answers.invoice_shopify_order || answers.invoice_receipt_ref);
  if (!value) return "";
  const order = value.match(/#?\d+/)?.[0] || value;
  return `Ordine Shopify ${order.startsWith("#") ? order : `#${order}`}`.slice(0, 1000);
}

function sibillPaymentMethod(value: unknown) {
  const normalized = clean(value).toLowerCase();
  if (normalized.includes("contant")) return "CASH";
  if (normalized.includes("bonific")) return "TRANSFER";
  if (normalized.includes("carta") || normalized.includes("bancomat")) return "CARD";
  return "OTHER";
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

  const importedNet = Number.parseFloat(clean(answers.invoice_shopify_net_amount).replace(",", "."));
  const importedVat = Number.parseFloat(clean(answers.invoice_shopify_tax_amount).replace(",", "."));
  const hasReconciledShopifyTax = Number.isFinite(importedNet) && importedNet > 0 &&
    Number.isFinite(importedVat) && importedVat > 0 &&
    Math.abs(importedNet + importedVat - grossAmount) < 0.011;
  const netAmount = hasReconciledShopifyTax
    ? importedNet
    : Math.round((grossAmount / 1.22) * 100) / 100;
  const vatAmount = hasReconciledShopifyTax
    ? importedVat
    : Math.round((grossAmount - netAmount) * 100) / 100;
  const vatRate = 22;
  const invoiceDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
  const requestedDestinationCode = clean(answers.invoice_sdi_code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  // FPR12 accepts exactly seven characters. Old forms sometimes contain notes
  // next to the code: never forward that invalid text to Sibill.
  const destinationCode = isCompany && /^[A-Z0-9]{7}$/.test(requestedDestinationCode)
    ? requestedDestinationCode
    : "0000000";
  const pec = clean(answers.invoice_pec).toLowerCase();
  const shopifyDescription = shopifyOrderDescription(answers);

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
            ...(shopifyDescription ? { causale: [shopifyDescription] } : {}),
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
              ...(shopifyDescription ? {
                altri_dati_gestionali: [{
                  tipo_dato: "SHOPIFY",
                  riferimento_testo: shopifyDescription,
                }],
              } : {}),
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

async function updateSibillDocumentNotes(input: {
  config: ReturnType<typeof sibillConfig>;
  companyId: string;
  documentId: string;
  notes: string;
}) {
  if (!input.notes) return;
  const response = await fetch(
    `${input.config.baseUrl}/api/v1/companies/${encodeURIComponent(input.companyId)}/documents/${encodeURIComponent(input.documentId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: input.notes }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    const data = await sibillJson(response);
    throw new SibillDraftError(sibillErrorMessage(data, "Descrizione Shopify non salvata su Sibill."), response.status);
  }
}

export function selectSibillAccountId(
  accounts: SibillAccount[],
  paymentMethod: string,
  configuredId?: string,
  accountMatch?: string,
) {
  const selectUniqueHighestBalance = (candidates: SibillAccount[]) => {
    const ranked = candidates
      .map((account) => ({
        id: account.id,
        balance: Number(account.current_balance?.amount ?? account.available_balance?.amount ?? Number.NaN),
      }))
      .filter((account) => Number.isFinite(account.balance))
      .sort((left, right) => right.balance - left.balance);
    if (ranked.length > 0 && (ranked.length === 1 || ranked[0].balance > ranked[1].balance)) {
      return ranked[0].id;
    }
    return null;
  };

  const euroAccounts = accounts.filter((account) => {
    const currency = clean(
      account.currency || account.current_balance?.currency || account.available_balance?.currency,
    ).toUpperCase();
    return currency === "EUR";
  });

  const explicitId = clean(configuredId);
  if (explicitId) {
    return accounts.some((account) => account.id === explicitId) ? explicitId : null;
  }

  const match = clean(accountMatch).toLowerCase();
  if (match) {
    const matchingAccounts = accounts.filter((account) =>
      clean(account.nickname).toLowerCase().includes(match)
    );
    if (matchingAccounts.length === 1) return matchingAccounts[0].id;

    if (matchingAccounts.length > 1) {
      const matchingEuroAccounts = matchingAccounts.filter((account) => {
        const currency = clean(
          account.currency || account.current_balance?.currency || account.available_balance?.currency,
        ).toUpperCase();
        return currency === "EUR";
      });
      if (matchingEuroAccounts.length === 1) return matchingEuroAccounts[0].id;

      const rankedMatch = selectUniqueHighestBalance(
        matchingEuroAccounts.length > 0 ? matchingEuroAccounts : matchingAccounts,
      );
      if (rankedMatch) return rankedMatch;
    }
  }

  // Sibill's account API can return only the nickname "Main", while the web
  // interface separately displays the masked number. For card payments, use
  // the single active EUR account with the uniquely highest balance.
  if (paymentMethod === "CARD") {
    if (euroAccounts.length === 1) return euroAccounts[0].id;
    const rankedEuroAccount = selectUniqueHighestBalance(euroAccounts);
    if (rankedEuroAccount) return rankedEuroAccount;
  }

  // A single connected account is unambiguous. Never pick the first one when
  // Sibill exposes multiple accounts, because that could misclassify an income.
  if (accounts.length === 1) return accounts[0].id;
  return null;
}

async function resolveSibillPaymentAccountId(input: {
  config: ReturnType<typeof sibillConfig>;
  companyId: string;
  paymentMethod: string;
}) {
  const response = await fetch(
    `${input.config.baseUrl}/api/v1/companies/${encodeURIComponent(input.companyId)}/accounts?page_size=100`,
    {
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  const data = await sibillJson(response);
  if (!response.ok) {
    throw new SibillDraftError(sibillErrorMessage(data, "Conti Sibill non disponibili."), response.status);
  }

  const accounts = Array.isArray(data?.data) ? data.data as SibillAccount[] : [];
  const isCard = input.paymentMethod === "CARD";
  const configuredId = isCard ? process.env.SIBILL_CARD_ACCOUNT_ID : process.env.SIBILL_DEFAULT_ACCOUNT_ID;
  const accountMatch = isCard
    ? process.env.SIBILL_CARD_ACCOUNT_MATCH?.trim() || "5597"
    : process.env.SIBILL_DEFAULT_ACCOUNT_MATCH;
  const accountId = selectSibillAccountId(accounts, input.paymentMethod, configuredId, accountMatch);

  if (!accountId) {
    throw new SibillDraftError(
      isCard
        ? "Conto carta 5597 non trovato in Sibill: collega il conto o configura il suo identificativo."
        : "Conto predefinito non identificato in Sibill.",
      422,
    );
  }
  return accountId;
}

async function markSibillDocumentPaid(input: {
  config: ReturnType<typeof sibillConfig>;
  companyId: string;
  documentId: string;
  responseId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
}) {
  const baseUrl = `${input.config.baseUrl}/api/v1/companies/${encodeURIComponent(input.companyId)}/documents/${encodeURIComponent(input.documentId)}/flows`;
  const headers = {
    Authorization: `Bearer ${input.config.token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const listResponse = await fetch(baseUrl, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const listData = await sibillJson(listResponse);
  if (!listResponse.ok) {
    throw new SibillDraftError(sibillErrorMessage(listData, "Stato del pagamento Sibill non disponibile."), listResponse.status);
  }

  const flows = Array.isArray(listData?.data) ? listData.data : [];
  const existingFlow = flows[0];
  const accountId = await resolveSibillPaymentAccountId({
    config: input.config,
    companyId: input.companyId,
    paymentMethod: input.paymentMethod,
  });

  if (existingFlow?.id && existingFlow.account_id !== accountId) {
    const deleteResponse = await fetch(`${baseUrl}/${encodeURIComponent(existingFlow.id)}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!deleteResponse.ok) {
      const deleteData = await sibillJson(deleteResponse);
      throw new SibillDraftError(sibillErrorMessage(deleteData, "Scadenza Sibill senza conto non sostituibile."), deleteResponse.status);
    }
  }

  const canUpdateExisting = existingFlow?.id && existingFlow.account_id === accountId;
  const body = canUpdateExisting
    ? {
        payment_date: input.paymentDate,
        payment_method: input.paymentMethod,
        payment_status: "PAID",
      }
    : {
        account_id: accountId,
        amount: { amount: money(input.amount), currency: "EUR" },
        expected_payment_date: input.paymentDate,
        external_id: `paradise-${input.responseId}`,
        payment_date: input.paymentDate,
        payment_method: input.paymentMethod,
        payment_status: "PAID",
      };
  const response = await fetch(canUpdateExisting ? `${baseUrl}/${encodeURIComponent(existingFlow.id)}` : baseUrl, {
    method: canUpdateExisting ? "PATCH" : "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const data = await sibillJson(response);
    throw new SibillDraftError(sibillErrorMessage(data, "Sibill non ha impostato la fattura come incassata."), response.status);
  }
}

export async function createSibillDraft(input: {
  answers: Record<string, unknown>;
  responseId: string;
  createdAt?: Date;
}) {
  const { config, company } = await loadSibillCompany();
  let preparedAnswers: Record<string, unknown>;
  try {
    preparedAnswers = await enrichInvoiceAnswersFromShopify(input.answers);
  } catch (error) {
    throw new SibillDraftError(error instanceof Error ? error.message : "Ordine Shopify non verificato.");
  }
  try {
    preparedAnswers = await enrichCompanyInvoiceIdentity(preparedAnswers);
  } catch (error) {
    throw new SibillDraftError(
      error instanceof Error ? error.message : "Ragione sociale non verificata dalla Partita IVA.",
    );
  }
  const payload = buildSibillInvoiceDraft(preparedAnswers, company, input.createdAt);
  const reference = clean(preparedAnswers.invoice_receipt_ref || preparedAnswers.invoice_shopify_order) || input.responseId;
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

  const warnings: string[] = [];
  const shopifyDescription = shopifyOrderDescription(preparedAnswers);
  try {
    await updateSibillDocumentNotes({
      config,
      companyId: company.id,
      documentId,
      notes: shopifyDescription,
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Descrizione Shopify non salvata su Sibill.");
  }

  let paymentStatus = "TO_PAY";
  const shopifyFinancialStatus = clean(preparedAnswers.invoice_shopify_financial_status).toLowerCase();
  if (shopifyFinancialStatus === "paid") {
    try {
      const grossAmount = Number.parseFloat(clean(preparedAnswers.invoice_amount).replace(",", "."));
      const paymentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(input.createdAt || new Date());
      await markSibillDocumentPaid({
        config,
        companyId: company.id,
        documentId,
        responseId: input.responseId,
        amount: grossAmount,
        paymentDate,
        paymentMethod: sibillPaymentMethod(preparedAnswers.invoice_payment_method),
      });
      paymentStatus = "PAID";
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Stato Incassata non salvato su Sibill.");
    }
  } else {
    warnings.push(`Ordine Shopify non completamente pagato (${shopifyFinancialStatus || "stato non disponibile"}): la bozza resta da incassare.`);
  }

  return {
    id: documentId,
    status: clean(document?.status) || "DRAFT",
    number: clean(document?.number),
    companyId: company.id,
    paymentStatus,
    warnings,
  };
}

export async function deleteSibillDraft(documentId: string) {
  const id = clean(documentId);
  if (!id) throw new SibillDraftError("Bozza Sibill non trovata.", 404);

  const { config, company } = await loadSibillCompany();
  const response = await fetch(
    `${config.baseUrl}/api/v1/companies/${encodeURIComponent(company.id)}/documents/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );

  // A missing remote document is already in the desired state, so the local
  // link can be removed safely as well.
  if (response.status === 404) return;
  if (!response.ok) {
    const data = await sibillJson(response);
    throw new SibillDraftError(
      sibillErrorMessage(data, "Sibill non ha permesso di eliminare questa bozza."),
      response.status,
    );
  }
}
