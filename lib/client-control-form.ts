import { prisma } from "@/lib/prisma";

export const CLIENT_CONTROL_FORM_NAME = "Controllo Cliente";
export const CLIENT_CONTROL_FORM_CATEGORY = "Qualita";

export const CLIENT_CONTROL_FIELD_IDS = {
  location: "client_control_location",
  clientName: "client_control_client_name",
  email: "client_control_email",
  phone: "client_control_phone",
  depositPaid: "client_control_deposit_paid",
  paid: "client_control_paid",
  paymentMethod: "client_control_payment_method",
  paymentGateway: "client_control_payment_gateway",
  paymentStatus: "client_control_payment_status",
  paymentVerified: "client_control_payment_verified",
  paymentReference: "client_control_payment_reference",
  paymentProcessedAt: "client_control_payment_processed_at",
  serviceOwner: "client_control_service_owner",
  serviceStaff: "client_control_service_staff",
  shopifyOrder: "client_control_shopify_order",
  notes: "client_control_notes",
  beforeMedia: "client_control_before_media",
  afterMedia: "client_control_after_media",
  instagramTag: "client_control_instagram_tag",
  products: "client_control_products",
  productsList: "client_control_products_list",
  review: "client_control_review",
  correctness: "client_control_correctness",
  clientPhoto: "client_control_photo",
} as const;

export const CLIENT_CONTROL_FORM_FIELDS = [
  {
    id: CLIENT_CONTROL_FIELD_IDS.location,
    label: "Sede",
    type: "select",
    required: true,
    options: ["Salone Buenos Aires", "Salone Duomo", "Ufficio Paradise"],
    description: "Seleziona il salone relativo al servizio.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.clientName,
    label: "Nome cliente",
    type: "text",
    required: true,
    description: "Il nome completo del cliente.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.email,
    label: "Email",
    type: "text",
    required: false,
    description: "Indirizzo email del cliente.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.phone,
    label: "Telefono",
    type: "text",
    required: false,
    description: "Numero di telefono del cliente.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.depositPaid,
    label: "Acconto pagato",
    type: "money",
    required: true,
    description: "Importo acconto pagato dalla cliente.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.paid,
    label: "Pagato",
    type: "money",
    required: true,
    description: "Totale pagato o saldo incassato.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.paymentMethod,
    label: "Metodo pagamento finale",
    type: "select",
    required: false,
    options: ["Carta", "Shopify", "Contanti", "Cashmatic", "Da verificare"],
    description: "Compilato automaticamente verificando il secondo ordine Shopify.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.serviceOwner,
    label: "Responsabile servizio",
    type: "worker",
    required: true,
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.serviceStaff,
    label: "Chi ha lavorato su questo cliente",
    type: "worker_multi",
    required: true,
    description: "Seleziona tutto il personale coinvolto: il bonus mensile viene calcolato da qui.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.shopifyOrder,
    label: "Ordine Shopify",
    type: "text",
    required: false,
    description: "Numero ordine o riferimento Shopify, se presente.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.notes,
    label: "Note",
    type: "checkbox",
    required: false,
    description: "Ho fatto le note su Shopify.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.beforeMedia,
    label: "Prima foto/video",
    type: "checkbox",
    required: false,
    description: "Ho fatto la foto e il video del prima.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.afterMedia,
    label: "Dopo foto/video",
    type: "checkbox",
    required: false,
    description: "Ho fatto la foto e il video del dopo.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.instagramTag,
    label: "IG tag",
    type: "text",
    required: false,
    description: "Tag Instagram del cliente o del contenuto.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.products,
    label: "Prodotti",
    type: "checkbox",
    required: false,
    description: "La cliente ha acquistato almeno 1 prodotto.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.productsList,
    label: "Prodotti acquistati",
    type: "text",
    required: false,
    description: "Lista dei prodotti acquistati su Shopify (compilato in automatico).",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.review,
    label: "Recensione",
    type: "checkbox",
    required: false,
    description: "La cliente ha fatto la recensione su Shopify.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.clientPhoto,
    label: "Foto volto cliente",
    type: "file",
    required: false,
    description: "Carica la foto volto/cliente.",
  },
  {
    id: CLIENT_CONTROL_FIELD_IDS.correctness,
    label: "Corretto?",
    type: "select",
    required: true,
    options: ["Da controllare", "Errore", "Controllato", "Finito", "No Show"],
    description: "Da controllare e il valore predefinito.",
  },
];

export function isClientControlFormName(name?: string | null, category?: string | null) {
  const text = `${name ?? ""} ${category ?? ""}`.toUpperCase();
  return text.includes("CONTROLLO CLIENTE") || text.includes("QUALITA");
}

export async function ensureClientControlForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: CLIENT_CONTROL_FORM_NAME },
        { name: { contains: "controllo cliente", mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    const roles = existing.allowed_roles as string[] | null;
    const notifyRoles = existing.notify_roles as string[] | null;
    const expectedRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
    const expectedNotifyRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"];

    const currentFields = Array.isArray(existing.fields) ? existing.fields as Array<{ id?: string }> : [];
    const currentFieldIds = new Set(currentFields.map((field) => field.id));
    const hasPaymentVerificationFields = currentFieldIds.has(CLIENT_CONTROL_FIELD_IDS.paymentMethod);

    const alreadyReady =
      existing.category === CLIENT_CONTROL_FORM_CATEGORY &&
      existing.active &&
      JSON.stringify(roles ?? []) === JSON.stringify(expectedRoles) &&
      JSON.stringify(notifyRoles ?? []) === JSON.stringify(expectedNotifyRoles) &&
      Boolean(existing.fields) &&
      hasPaymentVerificationFields;

    if (alreadyReady) return existing;

    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: CLIENT_CONTROL_FORM_CATEGORY,
        icon: existing.icon || "FileCheck2",
        active: true,
        allowed_roles: expectedRoles,
        notify_roles: expectedNotifyRoles,
        fields: CLIENT_CONTROL_FORM_FIELDS,
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: CLIENT_CONTROL_FORM_NAME,
      description: "Scheda cliente per bonus mensile: sede, cliente, pagamento, personale coinvolto, ordine Shopify e check operativi.",
      category: CLIENT_CONTROL_FORM_CATEGORY,
      icon: "FileCheck2",
      active: true,
      allowed_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: CLIENT_CONTROL_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
