import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";

export type ShopifyPaymentRegisterRow = {
  id: string;
  createdAt: Date;
  locationName: string | null;
  method: string;
  verified: boolean;
  amount: number;
  order: string;
  clientName: string;
  gateway: string;
  status: string;
  reference: string;
};

function moneyValue(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

export async function getShopifyPaymentRegister(options: {
  start: Date;
  end: Date;
  locationId?: string | null;
}) {
  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true },
  });
  const formIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);

  if (!formIds.length) return [];

  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      form_id: { in: formIds },
      created_at: { gte: options.start, lt: options.end },
      ...(options.locationId ? { user_location_id: options.locationId } : {}),
    },
    select: {
      id: true,
      created_at: true,
      user_location_name: true,
      answers: true,
    },
    orderBy: { created_at: "desc" },
  });

  return responses
    .map((response): ShopifyPaymentRegisterRow => {
      const answers = response.answers as Record<string, unknown>;
      const method = String(answers[CLIENT_CONTROL_FIELD_IDS.paymentMethod] || "DA_VERIFICARE").toUpperCase();
      return {
        id: response.id,
        createdAt: response.created_at,
        locationName: response.user_location_name,
        method,
        verified: answers[CLIENT_CONTROL_FIELD_IDS.paymentVerified] === true,
        amount: moneyValue(answers[CLIENT_CONTROL_FIELD_IDS.paid]),
        order: String(answers.second_shopify_order || ""),
        clientName: String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] || "Cliente"),
        gateway: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentGateway] || ""),
        status: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentStatus] || ""),
        reference: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentReference] || ""),
      };
    })
    .filter((payment) => Boolean(payment.order) || payment.verified || payment.method !== "DA_VERIFICARE");
}
