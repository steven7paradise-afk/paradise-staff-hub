import { prisma } from "@/lib/prisma";

export const ITALIAN_INVOICE_FORM_NAME = "Richiesta Fattura";
export const ITALIAN_INVOICE_FORM_CATEGORY = "Fatturazione";

export const ITALIAN_INVOICE_FIELD_IDS = {
  clientType: "invoice_client_type",
  shopifyOrder: "invoice_shopify_order",
  clientName: "invoice_client_name",
  fiscalCode: "invoice_fiscal_code",
  vatNumber: "invoice_vat_number",
  sdiCode: "invoice_sdi_code",
  pec: "invoice_pec",
  address: "invoice_address",
  amount: "invoice_amount",
  paymentMethod: "invoice_payment_method",
  receiptRef: "invoice_receipt_ref",
  notes: "invoice_notes",
} as const;

export const ITALIAN_INVOICE_FORM_FIELDS = [
  {
    id: ITALIAN_INVOICE_FIELD_IDS.clientType,
    label: "TIPO CLIENTE",
    type: "select",
    required: true,
    options: ["Privato (Codice Fiscale)", "Azienda / Libero Professionista (Partita IVA)"],
    description: "Seleziona se la fattura deve essere intestata a un privato o a una ditta/professionista.",
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.shopifyOrder,
    label: "ORDINE SHOPIFY (OPZIONALE)",
    type: "text",
    required: false,
    description: "Inserisci il numero d'ordine (es. #12345) o il nome per importare i dati. Lascia vuoto e clicca 'Importa' per l'ordine più recente.",
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.vatNumber,
    label: "PARTITA IVA",
    type: "text",
    required: true,
    description: "Partita IVA (11 cifre). Clicca su 'Cerca' per trovare i dati aziendali.",
    show_if: {
      field_id: ITALIAN_INVOICE_FIELD_IDS.clientType,
      operator: "equals",
      value: "Azienda / Libero Professionista (Partita IVA)",
    },
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.fiscalCode,
    label: "CODICE FISCALE",
    type: "text",
    required: true,
    description: "Codice Fiscale del cliente (16 caratteri).",
    show_if: {
      field_id: ITALIAN_INVOICE_FIELD_IDS.clientType,
      operator: "equals",
      value: "Privato (Codice Fiscale)",
    },
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.clientName,
    label: "NOME / RAGIONE SOCIALE",
    type: "text",
    required: true,
    description: "Nome e cognome completi del privato o ragione sociale della ditta (autocompilato se hai cercato la Partita IVA o l'ordine Shopify).",
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.address,
    label: "INDIRIZZO DI FATTURAZIONE",
    type: "text",
    required: true,
    description: "Via, civico, CAP, città e provincia (autocompilato se hai cercato la Partita IVA).",
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.sdiCode,
    label: "CODICE DESTINATARIO (SDI)",
    type: "text",
    required: false,
    description: "Codice SDI per la fatturazione elettronica (7 caratteri). Se non specificato, verrà usato '0000000'.",
    show_if: {
      field_id: ITALIAN_INVOICE_FIELD_IDS.clientType,
      operator: "equals",
      value: "Azienda / Libero Professionista (Partita IVA)",
    },
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.pec,
    label: "PEC (EMAIL CERTIFICATA)",
    type: "text",
    required: false,
    description: "Indirizzo PEC aziendale per l'invio della fattura (opzionale).",
    show_if: {
      field_id: ITALIAN_INVOICE_FIELD_IDS.clientType,
      operator: "equals",
      value: "Azienda / Libero Professionista (Partita IVA)",
    },
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.amount,
    label: "IMPORTO DA FATTURARE",
    type: "money",
    required: true,
    description: "Importo totale incassato da fatturare.",
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.paymentMethod,
    label: "METODO DI PAGAMENTO",
    type: "select",
    required: true,
    options: ["Carta di Credito / Bancomat", "Contanti", "Bonifico Bancario", "Altro"],
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.receiptRef,
    label: "RIFERIMENTO SCONTRINO / ORDINE",
    type: "text",
    required: false,
    description: "Numero scontrino o riferimento d'ordine relativo all'incasso.",
  },
  {
    id: ITALIAN_INVOICE_FIELD_IDS.notes,
    label: "NOTE AGGIUNTIVE",
    type: "textarea",
    required: false,
    description: "Dettagli sui trattamenti o prodotti acquistati.",
  },
];

export async function ensureItalianInvoiceForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: ITALIAN_INVOICE_FORM_NAME },
        { name: { contains: "fattura", mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    const roles = existing.allowed_roles as string[] | null;
    const notifyRoles = existing.notify_roles as string[] | null;
    const expectedRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
    const expectedNotifyRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
    const alreadyReady =
      existing.category === ITALIAN_INVOICE_FORM_CATEGORY &&
      existing.active &&
      JSON.stringify(roles ?? []) === JSON.stringify(expectedRoles) &&
      JSON.stringify(notifyRoles ?? []) === JSON.stringify(expectedNotifyRoles) &&
      JSON.stringify(existing.fields) === JSON.stringify(ITALIAN_INVOICE_FORM_FIELDS);

    if (alreadyReady) return existing;

    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: ITALIAN_INVOICE_FORM_CATEGORY,
        icon: existing.icon || "ReceiptText",
        active: true,
        allowed_roles: expectedRoles,
        notify_roles: expectedNotifyRoles,
        fields: ITALIAN_INVOICE_FORM_FIELDS,
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: ITALIAN_INVOICE_FORM_NAME,
      description: "Modulo per richiedere l'emissione di una fattura elettronica italiana (per privati o aziende/professionisti).",
      category: ITALIAN_INVOICE_FORM_CATEGORY,
      icon: "ReceiptText",
      active: true,
      allowed_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: ITALIAN_INVOICE_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
