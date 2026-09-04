import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const ORDER_FORM_NAME = "Modulo Ordine";
export const ORDER_FORM_CATEGORY = "Ordini";

export const ORDER_FORM_FIELD_IDS = {
  shopifyOrder: "order_shopify_order",
  clientName: "order_client_name",
  clientEmail: "order_client_email",
  clientPhone: "order_client_phone",
  paidAmount: "order_paid_amount",
} as const;

const ORDER_CUSTOMER_FIELDS = [
  { id: ORDER_FORM_FIELD_IDS.shopifyOrder, label: "Numero ordine Shopify", type: "text", required: true, description: "Inserisci il numero dell'ordine, per esempio 26320. Cliente e pagamento verranno compilati automaticamente." },
  { id: ORDER_FORM_FIELD_IDS.clientName, label: "Nome e cognome cliente", type: "text", required: true, description: "Compilato automaticamente da Shopify; puoi correggerlo se necessario." },
  { id: ORDER_FORM_FIELD_IDS.clientEmail, label: "Email cliente", type: "text", required: false, description: "Compilata automaticamente da Shopify quando disponibile." },
  { id: ORDER_FORM_FIELD_IDS.clientPhone, label: "Telefono cliente", type: "text", required: false, description: "Compilato automaticamente da Shopify quando disponibile." },
  { id: ORDER_FORM_FIELD_IDS.paidAmount, label: "Importo già pagato", type: "money", required: true, description: "Somma dei pagamenti riusciti registrati su Shopify; verifica prima di continuare." },
] as const;

export const ORDER_FORM_FIELDS = [
  ...ORDER_CUSTOMER_FIELDS,
  { id: "order_items", label: "Cosa dobbiamo fare?", type: "textarea", required: true, description: "Descrivi il lavoro richiesto dalla cliente." },
  { id: "order_details", label: "Dettagli della lavorazione", type: "textarea", required: false, description: "Inserisci fasce, misure, colori e altre indicazioni utili." },
  { id: "order_delivery", label: "Consegna", type: "select", required: true, options: ["Ritiro in negozio", "Spedizione"] },
  { id: "order_attachment", label: "Foto ordine", type: "file", required: false },
  { id: "order_notes", label: "Note ordine", type: "textarea", required: false },
];

function normalizeLabel(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function mergeOrderCustomerFields(fields: unknown) {
  const existingFields = Array.isArray(fields)
    ? fields.filter((field) => field && typeof field === "object") as Array<Record<string, unknown>>
    : [];
  const coreIds = new Set<string>(Object.values(ORDER_FORM_FIELD_IDS));
  const isReplacedCustomerField = (field: Record<string, unknown>) => {
    if (coreIds.has(String(field.id))) return true;
    const label = normalizeLabel(field.label);
    return /^(numero )?ordine shopify/.test(label)
      || /^(nome( e)? cognome|nome cliente|cliente)$/.test(label)
      || /^(e ?mail|email)( cliente)?$/.test(label)
      || /^(telefono|cellulare|numero di telefono)( cliente)?$/.test(label)
      || /^(quanto ha pagato|ha pagato|importo( gia)? pagato)$/.test(label);
  };

  return [
    ...ORDER_CUSTOMER_FIELDS.map((field) => ({ ...field })),
    ...existingFields.filter((field) => !isReplacedCustomerField(field)),
  ];
}

export async function ensureOrderForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: ORDER_FORM_NAME },
        { name: { contains: "ordine", mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    const roles = existing.allowed_roles as string[] | null;
    const notifyRoles = existing.notify_roles as string[] | null;
    const expectedRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
    const expectedNotifyRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
    const mergedFields = mergeOrderCustomerFields(existing.fields);
    const alreadyReady =
      existing.category === ORDER_FORM_CATEGORY &&
      existing.active &&
      JSON.stringify(roles ?? []) === JSON.stringify(expectedRoles) &&
      JSON.stringify(notifyRoles ?? []) === JSON.stringify(expectedNotifyRoles) &&
      JSON.stringify(existing.fields) === JSON.stringify(mergedFields);

    if (alreadyReady) return existing;

    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        description: "Collega l'ordine Shopify, verifica i dati della cliente e completa le informazioni della lavorazione.",
        category: ORDER_FORM_CATEGORY,
        icon: existing.icon || "ShoppingCart",
        active: true,
        allowed_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
        notify_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
        fields: mergedFields as Prisma.InputJsonValue,
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: ORDER_FORM_NAME,
      description: "Collega l'ordine Shopify, verifica i dati della cliente e completa le informazioni della lavorazione.",
      category: ORDER_FORM_CATEGORY,
      icon: "ShoppingCart",
      active: true,
      allowed_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: ORDER_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
