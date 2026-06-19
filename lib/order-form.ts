import { prisma } from "@/lib/prisma";

export const ORDER_FORM_NAME = "Modulo Ordine";
export const ORDER_FORM_CATEGORY = "Ordini";

export const ORDER_FORM_FIELDS = [
  { id: "order_title", label: "Nome ordine", type: "text", required: true, description: "Esempio: prodotti cabina, materiale festa, forniture reception" },
  { id: "order_items", label: "Cosa ordinare", type: "textarea", required: true, description: "Inserisci prodotti, quantita, colori, misure o dettagli utili." },
  { id: "order_supplier", label: "Fornitore / link acquisto", type: "textarea", required: false, description: "Amazon, sito fornitore, link prodotto o contatto." },
  { id: "order_budget", label: "Budget indicativo", type: "money", required: false },
  { id: "order_priority", label: "Priorita", type: "select", required: true, options: ["Normale", "Urgente", "Bloccante"] },
  { id: "order_needed_by", label: "Serve entro", type: "date", required: false },
  { id: "order_attachment", label: "Foto / PDF / preventivo", type: "file", required: false },
  { id: "order_notes", label: "Note interne", type: "textarea", required: false },
];

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
    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: ORDER_FORM_CATEGORY,
        icon: existing.icon || "ShoppingCart",
        active: true,
        allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
        notify_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: ORDER_FORM_NAME,
      description: "Modulo per richiedere materiali, prodotti e forniture per il salone.",
      category: ORDER_FORM_CATEGORY,
      icon: "ShoppingCart",
      active: true,
      allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: ORDER_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
