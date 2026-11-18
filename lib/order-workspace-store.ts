import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeScannedOrderReference, orderCodeCandidates } from "@/lib/order-code-reader";
import { isOrderInWorkspace, type OrderWorkspace } from "@/lib/order-workspace";
import { isOrderVisibleForOperationalLocation } from "@/lib/order-visibility";

const orderInclude = {
  user: { select: { id: true, name: true, role: true, photo_url: true, sede_id: true, location: { select: { name: true } } } },
  form: true,
} satisfies Prisma.ServiceFormResponseInclude;

const orderJoins = Prisma.sql`
  FROM service_form_responses r
  JOIN service_forms f ON f.id = r.form_id
  JOIN users u ON u.id = r.user_id
  LEFT JOIN locations l ON l.id = u.sede_id
`;

function orderScope(operationalLocationId: string) {
  return Prisma.sql`
    r.status <> 'ARCHIVED'
    AND (LOWER(f.category) = 'ordini' OR LOWER(f.name) LIKE '%ordine%')
    AND ${operationalLocationId ? Prisma.sql`(
      r.user_location_id = ${operationalLocationId} OR u.sede_id = ${operationalLocationId}
      OR LOWER(COALESCE(r.user_location_name, '')) LIKE '%ufficio%'
      OR LOWER(COALESCE(l.name, '')) LIKE '%ufficio%'
    )` : Prisma.sql`TRUE`}
  `;
}

// Match Object.values(answers), including legacy array answers. An object.name
// array stringifies as comma-separated scalar leaves in JS; commas cannot join
// fragments into "conver", and nested objects stringify as [object Object].
// Recurse through arrays only, so those objects and JSON keys never classify.
const conversionPredicate = Prisma.sql`EXISTS (
  WITH RECURSIVE answer_values(value) AS (
    SELECT value FROM jsonb_each(CASE WHEN jsonb_typeof(r.answers) = 'object' THEN r.answers ELSE '{}'::jsonb END)
    UNION ALL
    SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.answers) = 'array' THEN r.answers ELSE '[]'::jsonb END)
  ), name_values(value) AS (
    SELECT CASE WHEN jsonb_typeof(value) = 'object' THEN value->'name'
      WHEN jsonb_typeof(value) = 'array' THEN NULL::jsonb ELSE value END
    FROM answer_values
    UNION ALL
    SELECT child.value FROM name_values parent
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(parent.value) = 'array' THEN parent.value ELSE '[]'::jsonb END) child
  )
  SELECT 1 FROM name_values
  WHERE jsonb_typeof(value) = 'string' AND LOWER(value #>> '{}') LIKE '%conver%'
)`;

function answerString(value: Prisma.Sql) {
  return Prisma.sql`CASE WHEN jsonb_typeof(${value}) = 'object' THEN ${value}->>'name' ELSE ${value} #>> '{}' END`;
}

const visibleNumber = Prisma.sql`COALESCE(
  NULLIF(${answerString(Prisma.sql`r.answers->'order_shopify_order'`)}, ''),
  NULLIF(${answerString(Prisma.sql`r.answers->'field_1782221517924'`)}, ''),
  NULLIF(${answerString(Prisma.sql`r.answers->'order_title'`)}, ''),
  NULLIF((SELECT ${answerString(Prisma.sql`r.answers->(field->>'id')`)}
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.fields) = 'array' THEN f.fields ELSE '[]'::jsonb END) field
    WHERE LOWER(field->>'label') LIKE '%ordine%' OR LOWER(field->>'label') LIKE '%titolo%'
    LIMIT 1), ''),
  '#' || UPPER(SUBSTRING(r.id, 1, 5))
)`;

export async function loadOrderWorkspace(workspace: OrderWorkspace, operationalLocationId = "") {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT r.id ${orderJoins}
    WHERE ${orderScope(operationalLocationId)}
      AND ${workspace === "conversions" ? conversionPredicate : Prisma.sql`NOT (${conversionPredicate})`}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 300
  `);
  if (!rows.length) return [];
  const responses = await prisma.serviceFormResponse.findMany({
    where: { id: { in: rows.map((row) => row.id) }, status: { not: "ARCHIVED" } },
    include: orderInclude,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 300,
  });
  // Recheck hydrated rows if an order or its creator changed during the read.
  return responses.filter((response) => isOrderInWorkspace(response, workspace)
    && isOrderVisibleForOperationalLocation(response, operationalLocationId));
}

function answerText(value: unknown) {
  if (!value) return "";
  if (typeof value === "object") return "name" in value ? String(value.name ?? "") : "";
  return String(value);
}

function visibleOrderNumber(order: { id: string; answers: Prisma.JsonValue; form: { fields: Prisma.JsonValue } }) {
  const answers = order.answers && typeof order.answers === "object" && !Array.isArray(order.answers) ? order.answers : {};
  const fields = Array.isArray(order.form.fields) ? order.form.fields : [];
  const field = fields.find((value) => value && typeof value === "object" && !Array.isArray(value)
    && typeof value.label === "string" && ["nome ordine", "ordine", "titolo"].some((term) => value.label!.toString().toLowerCase().includes(term)));
  const fieldId = field && typeof field === "object" && !Array.isArray(field) ? String(field.id || "") : "";
  return answerText(answers.order_shopify_order) || answerText(answers.field_1782221517924)
    || answerText(answers.order_title) || answerText(answers[fieldId]) || `#${order.id.substring(0, 5).toUpperCase()}`;
}

/** Resolves old printed labels, response links and scanner references in scope. */
export async function findOrderWorkspaceReference(reference: string, operationalLocationId = "") {
  const normalized = normalizeScannedOrderReference(reference);
  if (!normalized) return null;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT r.id ${orderJoins}
    WHERE ${orderScope(operationalLocationId)} AND (
      LOWER(r.id) = ${normalized}
      OR LOWER(REGEXP_REPLACE(TRIM(${visibleNumber}), '^(PB-)?#?', '', 'i')) = ${normalized}
      OR EXISTS (
        SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(r.answers) = 'object' THEN r.answers ELSE '{}'::jsonb END) answer
        WHERE answer.key IN ('order_shopify_order', 'field_1782221517924', 'shopify_order_id', 'shopifyOrderId', 'shopify_admin_url', 'shopifyAdminUrl', 'order_url')
        AND LOWER(REGEXP_REPLACE(TRIM(${answerString(Prisma.sql`answer.value`)}), '^(PB-)?#?', '', 'i')) = ${normalized}
      )
      OR ${/^\d+$/.test(normalized) ? Prisma.sql`r.answers::text ~ ${`(?:gid://shopify/Order/|/orders/)${normalized}(?:[^0-9]|$)`}` : Prisma.sql`FALSE`}
    )
    ORDER BY (LOWER(r.id) = ${normalized}) DESC, r.created_at DESC, r.id DESC
    LIMIT 20
  `);
  if (!rows.length) return null;
  const responses = await prisma.serviceFormResponse.findMany({
    where: { id: { in: rows.map((row) => row.id) }, status: { not: "ARCHIVED" } },
    include: orderInclude,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 20,
  });
  responses.sort((a, b) => rows.findIndex((row) => row.id === a.id) - rows.findIndex((row) => row.id === b.id));
  return responses.find((order) => isOrderVisibleForOperationalLocation(order, operationalLocationId)
    && orderCodeCandidates({
      responseId: order.id,
      visibleOrderNumber: visibleOrderNumber(order),
      answers: order.answers as Record<string, unknown>,
    }).has(normalized)) ?? null;
}
