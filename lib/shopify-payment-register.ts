import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";
import { classifyShopifyPaymentMethod } from "@/lib/shopify";

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
    .flatMap((response): ShopifyPaymentRegisterRow[] => {
      const answers = response.answers as Record<string, unknown>;
      const storedMethod = String(answers[CLIENT_CONTROL_FIELD_IDS.paymentMethod] || "DA_VERIFICARE").toUpperCase();
      const gateway = String(answers[CLIENT_CONTROL_FIELD_IDS.paymentGateway] || "");
      // Correct the presentation of legacy rows created by the old rule that
      // incorrectly mapped the Shopify gateway "Cash" to Cashmatic.
      const detectedGatewayMethod = classifyShopifyPaymentMethod([gateway]);
      const method = storedMethod === "CASHMATIC" && detectedGatewayMethod === "CONTANTI"
        ? "CONTANTI"
        : storedMethod;
      const baseRow = {
        id: response.id,
        createdAt: response.created_at,
        locationName: response.user_location_name,
        method,
        verified: answers[CLIENT_CONTROL_FIELD_IDS.paymentVerified] === true,
        amount: moneyValue(answers[CLIENT_CONTROL_FIELD_IDS.paid]),
        order: String(answers.second_shopify_order || ""),
        clientName: String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] || "Cliente"),
        gateway,
        status: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentStatus] || ""),
        reference: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentReference] || ""),
      };
      const breakdown = Array.isArray(answers.client_control_payment_breakdown)
        ? answers.client_control_payment_breakdown.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        : [];
      if (breakdown.length > 1) {
        return breakdown.map((item, index) => ({
          ...baseRow,
          id: `${response.id}:${index}`,
          method: String(item.method || "DA_VERIFICARE").toUpperCase(),
          amount: moneyValue(item.amount),
          gateway: String(item.gateway || ""),
          reference: String(item.reference || ""),
        }));
      }
      return [baseRow];
    })
    .filter((payment) => Boolean(payment.order) || payment.verified || payment.method !== "DA_VERIFICARE");
}
