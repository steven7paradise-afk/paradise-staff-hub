import { Prisma } from "@prisma/client";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { allowsMissingFinalPaymentOrder } from "@/lib/client-control-service-rules";
import { prisma } from "@/lib/prisma";
import { getShopifyOrderDetails, isFuzzyNameMatch } from "@/lib/shopify";

type ShopifyDetails = NonNullable<Awaited<ReturnType<typeof getShopifyOrderDetails>>>;

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function cleanPhone(value: unknown) {
  return textValue(value).replace(/\D/g, "");
}

function dateRange(dateKey: string) {
  const next = new Date(`${dateKey}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextKey = next.toISOString().slice(0, 10);
  const offsetFor = (key: string) => {
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      timeZoneName: "longOffset",
    }).formatToParts(new Date(`${key}T12:00:00Z`))
      .find((part) => part.type === "timeZoneName")?.value || "GMT+01:00";
    return offset.replace("GMT", "");
  };
  return {
    start: new Date(`${dateKey}T00:00:00${offsetFor(dateKey)}`),
    end: new Date(`${nextKey}T00:00:00${offsetFor(nextKey)}`),
  };
}

export function shopifyOrderMatchesControl(
  answers: Record<string, unknown>,
  details: ShopifyDetails,
) {
  const clientName = textValue(answers[CLIENT_CONTROL_FIELD_IDS.clientName]);
  const email = textValue(answers[CLIENT_CONTROL_FIELD_IDS.email]).toLowerCase();
  const phone = cleanPhone(answers[CLIENT_CONTROL_FIELD_IDS.phone]);
  const orderEmail = textValue(details.email).toLowerCase();
  const orderPhone = cleanPhone(details.phone);
  const comparable = Boolean(
    (clientName && details.clientName) ||
    (email && orderEmail) ||
    (phone && orderPhone),
  );
  const matches = [
    Boolean(clientName && details.clientName && isFuzzyNameMatch(details.clientName, clientName)),
    Boolean(email && orderEmail && email === orderEmail),
    Boolean(phone && orderPhone && (phone.endsWith(orderPhone) || orderPhone.endsWith(phone))),
  ];
  return comparable && matches.some(Boolean);
}

export function canAutomaticallyCloseControl(options: {
  answers: Record<string, unknown>;
  finalOrder: ShopifyDetails | null;
  finalPaymentOptional: boolean;
}) {
  const { answers, finalOrder, finalPaymentOptional } = options;
  if (!finalOrder || !shopifyOrderMatchesControl(answers, finalOrder)) return false;
  const paid = textValue(finalOrder.financialStatus).toLowerCase() === "paid";
  const freeOptionalService = finalPaymentOptional && (finalOrder.totalPrice ?? 0) <= 0.009;
  return freeOptionalService || (paid && finalOrder.paymentMethod !== "DA_VERIFICARE");
}

export async function reconcileDailyClientControls(options: {
  dateKey: string;
  locationId: string;
  actorName: string;
}) {
  const { start, end } = dateRange(options.dateKey);
  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true },
  });
  const formIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);
  if (!formIds.length) {
    return { found: 0, synchronized: 0, autoClosed: 0, unresolved: 0 };
  }

  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      form_id: { in: formIds },
      user_location_id: options.locationId,
      OR: [
        { created_at: { gte: start, lt: end } },
        { updated_at: { gte: start, lt: end } },
      ],
    },
    select: { id: true, answers: true, activity_log: true },
  });

  const results = await Promise.all(responses.map(async (response) => {
    const answers = { ...((response.answers as Record<string, unknown>) || {}) };
    const isDraft = answers.client_control_is_draft === true
      || textValue(answers[CLIENT_CONTROL_FIELD_IDS.correctness]).toLowerCase() === "bozza";
    const depositOrderCode = textValue(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder]);
    const finalOrderCode = textValue(answers.second_shopify_order);
    const serviceValues = [
      ...(Array.isArray(answers.custom_services) ? answers.custom_services : []),
      answers.client_control_service_title,
    ];
    const finalPaymentOptional = allowsMissingFinalPaymentOrder(serviceValues);
    const codes = Array.from(new Set([
      depositOrderCode,
      finalOrderCode || (finalPaymentOptional ? depositOrderCode : ""),
    ].filter(Boolean)));
    const detailsByCode = new Map<string, ShopifyDetails | null>();
    await Promise.all(codes.map(async (code) => {
      detailsByCode.set(code, await getShopifyOrderDetails(code).catch(() => null));
    }));

    const depositOrder = depositOrderCode ? detailsByCode.get(depositOrderCode) ?? null : null;
    const effectiveFinalCode = finalOrderCode || (finalPaymentOptional ? depositOrderCode : "");
    const finalOrder = effectiveFinalCode ? detailsByCode.get(effectiveFinalCode) ?? null : null;
    let synchronized = false;

    if (depositOrder && shopifyOrderMatchesControl(answers, depositOrder)) {
      answers[CLIENT_CONTROL_FIELD_IDS.depositPaid] = depositOrder.paidAmount || depositOrder.totalPrice || 0;
      answers.client_control_shopify_order_note = depositOrder.note || "";
      answers.client_control_shopify_expected_paid = depositOrder.totalPrice;
      if (depositOrder.lineItems.length) {
        answers[CLIENT_CONTROL_FIELD_IDS.products] = true;
        answers[CLIENT_CONTROL_FIELD_IDS.productsList] = depositOrder.lineItems
          .map((item) => item.quantity > 1 ? `${item.title} (x${item.quantity})` : item.title)
          .join(", ");
      }
      synchronized = true;
    }

    const canClose = canAutomaticallyCloseControl({ answers, finalOrder, finalPaymentOptional });
    if (finalOrder && shopifyOrderMatchesControl(answers, finalOrder)) {
      answers[CLIENT_CONTROL_FIELD_IDS.paid] = finalOrder.paidAmount;
      answers[CLIENT_CONTROL_FIELD_IDS.paymentMethod] = finalOrder.paymentMethod;
      answers[CLIENT_CONTROL_FIELD_IDS.paymentGateway] = finalOrder.paymentGateways.join(", ");
      answers[CLIENT_CONTROL_FIELD_IDS.paymentStatus] = finalOrder.financialStatus || "";
      answers[CLIENT_CONTROL_FIELD_IDS.paymentVerified] = canClose;
      answers[CLIENT_CONTROL_FIELD_IDS.paymentReference] = finalOrder.paymentReference || "";
      answers[CLIENT_CONTROL_FIELD_IDS.paymentProcessedAt] = finalOrder.transactionProcessedAt || "";
      answers.client_control_payment_breakdown = finalOrder.paymentBreakdown;
      synchronized = true;
    }

    if (!synchronized && !canClose) {
      return { isDraft, synchronized: false, autoClosed: false, unresolved: isDraft };
    }

    if (isDraft && canClose) {
      answers.client_control_is_draft = false;
      answers[CLIENT_CONTROL_FIELD_IDS.correctness] = "Controllato";
    }
    answers.client_control_payment_checked_at = new Date().toISOString();
    answers.client_control_payment_checked_by = options.actorName;
    answers.client_control_daily_close_date = options.dateKey;

    const activity = Array.isArray(response.activity_log) ? response.activity_log : [];
    await prisma.serviceFormResponse.update({
      where: { id: response.id },
      data: {
        answers: answers as Prisma.InputJsonValue,
        activity_log: [
          ...activity,
          {
            type: isDraft && canClose ? "AUTO_CLOSED_WITH_DAILY_CLOSING" : "SHOPIFY_RECONCILED_WITH_DAILY_CLOSING",
            text: isDraft && canClose
              ? `Controllo Cliente salvato e chiuso automaticamente durante la chiusura del ${options.dateKey}.`
              : `Controllo Cliente allineato a Shopify durante la chiusura del ${options.dateKey}.`,
            by: options.actorName,
            at: new Date().toISOString(),
          },
        ] as Prisma.InputJsonValue,
      },
    });
    return {
      isDraft,
      synchronized,
      autoClosed: isDraft && canClose,
      unresolved: isDraft && !canClose,
    };
  }));

  return {
    found: results.length,
    synchronized: results.filter((result) => result.synchronized).length,
    autoClosed: results.filter((result) => result.autoClosed).length,
    unresolved: results.filter((result) => result.unresolved).length,
  };
}
