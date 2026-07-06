import { prisma } from "@/lib/prisma";

export const REFUND_FORM_NAME = "Richiesta Rimborso";
export const REFUND_FORM_CATEGORY = "Amministrazione";

export const REFUND_FIELD_IDS = {
  clientName: "refund_client_name",
  shopifyOrder: "refund_shopify_order",
  amount: "refund_amount",
  method: "refund_method",
  reason: "refund_reason",
  notes: "refund_notes",
} as const;

export const REFUND_FORM_FIELDS = [
  {
    id: REFUND_FIELD_IDS.clientName,
    label: "NOME E COGNOME CLIENTE",
    type: "text",
    required: true,
    description: "Inserisci il nome e cognome completi del cliente.",
  },
  {
    id: REFUND_FIELD_IDS.shopifyOrder,
    label: "ORDINE SHOPIFY (OPZIONALE)",
    type: "text",
    required: false,
    description: "Inserisci il numero d'ordine Shopify (es. #12345) per riferimento.",
  },
  {
    id: REFUND_FIELD_IDS.amount,
    label: "IMPORTO DA RIMBORSARE",
    type: "money",
    required: true,
    description: "Specifica la cifra esatta da rimborsare al cliente.",
  },
  {
    id: REFUND_FIELD_IDS.method,
    label: "METODO DI RIMBORSO",
    type: "select",
    required: true,
    options: ["Carta di Credito / Bancomat", "Contanti", "Scalapay / Klarna", "PayPal", "Bonifico Bancario", "Altro"],
    description: "Seleziona il metodo di pagamento originario o il canale utilizzato per il rimborso.",
  },
  {
    id: REFUND_FIELD_IDS.reason,
    label: "MOTIVAZIONE RIMBORSO",
    type: "textarea",
    required: true,
    description: "Dettaglia il motivo del rimborso (es. prodotto reso, errore battitura, servizio insoddisfacente, ecc.).",
  },
  {
    id: REFUND_FIELD_IDS.notes,
    label: "NOTE AGGIUNTIVE / NOTE STAFF",
    type: "textarea",
    required: false,
    description: "Note aggiuntive per l'amministrazione.",
  },
];

export async function ensureRefundForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: REFUND_FORM_NAME },
        { name: { contains: "rimborso", mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    const roles = existing.allowed_roles as string[] | null;
    const notifyRoles = existing.notify_roles as string[] | null;
    const expectedRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
    const expectedNotifyRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
    const alreadyReady =
      existing.category === REFUND_FORM_CATEGORY &&
      existing.active &&
      JSON.stringify(roles ?? []) === JSON.stringify(expectedRoles) &&
      JSON.stringify(notifyRoles ?? []) === JSON.stringify(expectedNotifyRoles) &&
      JSON.stringify(existing.fields) === JSON.stringify(REFUND_FORM_FIELDS);

    if (alreadyReady) return existing;

    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: REFUND_FORM_CATEGORY,
        icon: existing.icon || "RotateCcw",
        active: true,
        allowed_roles: expectedRoles,
        notify_roles: expectedNotifyRoles,
        fields: REFUND_FORM_FIELDS,
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: REFUND_FORM_NAME,
      description: "Modulo compilato dal personale in negozio per richiedere l'emissione di un rimborso a un cliente.",
      category: REFUND_FORM_CATEGORY,
      icon: "RotateCcw",
      active: true,
      allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: REFUND_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
