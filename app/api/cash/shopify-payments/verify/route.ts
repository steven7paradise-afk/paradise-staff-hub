import { NextRequest, NextResponse } from "next/server";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { getShopifyOrderDetails, isFuzzyNameMatch } from "@/lib/shopify";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const MAX_BATCH_SIZE = 5;

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function cleanPhone(value: unknown) {
  return textValue(value).replace(/\D/g, "");
}

function orderMatchesClient(answers: Record<string, unknown>, details: NonNullable<Awaited<ReturnType<typeof getShopifyOrderDetails>>>) {
  const submittedEmail = textValue(answers[CLIENT_CONTROL_FIELD_IDS.email]).toLowerCase();
  const submittedPhone = cleanPhone(answers[CLIENT_CONTROL_FIELD_IDS.phone]);
  const submittedName = textValue(answers[CLIENT_CONTROL_FIELD_IDS.clientName]);
  const orderEmail = textValue(details.email).toLowerCase();
  const orderPhone = cleanPhone(details.phone);
  const checks = [
    Boolean(submittedEmail && orderEmail && submittedEmail === orderEmail),
    Boolean(submittedPhone && orderPhone && (submittedPhone.endsWith(orderPhone) || orderPhone.endsWith(submittedPhone))),
    Boolean(submittedName && details.clientName && isFuzzyNameMatch(details.clientName, submittedName)),
  ];
  const hasComparableIdentity = Boolean(
    (submittedEmail && orderEmail) ||
    (submittedPhone && orderPhone) ||
    (submittedName && details.clientName)
  );

  return hasComparableIdentity && checks.some(Boolean);
}

export async function POST(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  if (!managementRoles.has(user.role)) {
    return NextResponse.json({ error: "Solo un responsabile può avviare il controllo massivo." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id: unknown) => textValue(id)).filter(Boolean).slice(0, MAX_BATCH_SIZE)
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: "Nessun ordine da controllare." }, { status: 400 });
  }

  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true },
  });
  const clientControlFormIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);

  const responses = await prisma.serviceFormResponse.findMany({
    where: { id: { in: ids }, form_id: { in: clientControlFormIds } },
    select: { id: true, answers: true },
  });

  const results = await Promise.all(responses.map(async (response) => {
    const answers: Record<string, any> = { ...((response.answers as Record<string, unknown>) || {}) };
    const order = textValue(answers.second_shopify_order || answers.secondShopifyOrder);
    if (!order) {
      return { id: response.id, order: "", outcome: "missing" as const };
    }

    const details = await getShopifyOrderDetails(order).catch(() => null);
    if (!details) {
      return { id: response.id, order, outcome: "not_found" as const };
    }

    const isPaid = textValue(details.financialStatus).toLowerCase() === "paid";
    const identityMatches = orderMatchesClient(answers, details);
    const verified = isPaid && identityMatches && details.paymentMethod !== "DA_VERIFICARE";

    answers[CLIENT_CONTROL_FIELD_IDS.paymentMethod] = details.paymentMethod;
    answers[CLIENT_CONTROL_FIELD_IDS.paymentGateway] = details.paymentGateways.join(", ");
    answers[CLIENT_CONTROL_FIELD_IDS.paymentStatus] = details.financialStatus || "";
    answers[CLIENT_CONTROL_FIELD_IDS.paymentVerified] = verified;
    answers[CLIENT_CONTROL_FIELD_IDS.paymentReference] = details.paymentReference || "";
    answers[CLIENT_CONTROL_FIELD_IDS.paymentProcessedAt] = details.transactionProcessedAt || "";
    answers.client_control_payment_breakdown = details.paymentBreakdown;
    answers.client_control_payment_checked_at = new Date().toISOString();
    answers.client_control_payment_checked_by = user.name || user.id;

    await prisma.serviceFormResponse.update({
      where: { id: response.id },
      data: { answers },
    });

    return {
      id: response.id,
      order,
      gateway: details.paymentGateways.join(", "),
      method: details.paymentMethod,
      outcome: verified
        ? "verified" as const
        : !isPaid
          ? "not_paid" as const
          : !identityMatches
            ? "identity_mismatch" as const
            : "unknown_gateway" as const,
    };
  }));

  const foundIds = new Set(responses.map((response) => response.id));
  for (const id of ids) {
    if (!foundIds.has(id)) results.push({ id, order: "", outcome: "missing" as const });
  }

  return NextResponse.json({
    processed: results.length,
    verified: results.filter((result) => result.outcome === "verified").length,
    unresolved: results.filter((result) => result.outcome !== "verified").length,
    results,
  });
}
