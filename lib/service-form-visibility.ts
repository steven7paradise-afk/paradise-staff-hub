export type ServiceFormCondition = {
  field_id?: string | null;
  value?: unknown;
  operator?: "equals" | "not_equals" | "contains" | string | null;
};

export type ConditionalServiceFormField = {
  show_if?: ServiceFormCondition | null;
  show_ifs?: ServiceFormCondition[] | null;
};

export const SERVICE_FORMS_VISIBILITY_KEY = "service_forms_visibility";

export type ServiceFormsVisibility = {
  hideWhenOffShiftFormIds: string[];
};

export function normalizeServiceFormsVisibility(value: unknown): ServiceFormsVisibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { hideWhenOffShiftFormIds: [] };
  }

  const data = value as Record<string, unknown>;
  return {
    hideWhenOffShiftFormIds: Array.isArray(data.hideWhenOffShiftFormIds)
      ? data.hideWhenOffShiftFormIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [],
  };
}

export function isServiceFormFieldVisible(
  field: ConditionalServiceFormField,
  answers: Record<string, unknown>,
) {
  const conditions = field.show_ifs?.length
    ? field.show_ifs
    : field.show_if?.field_id
      ? [field.show_if]
      : [];

  if (conditions.length === 0) return true;

  return conditions.some((condition) => {
    if (!condition.field_id) return true;

    const actualValue = String(answers[condition.field_id] ?? "").toLowerCase().trim();
    const expectedValue = String(condition.value ?? "").toLowerCase().trim();

    // This mirrors the form UI: an empty configured value means
    // "show after the source field has been filled in".
    if (!expectedValue) return Boolean(actualValue);
    if (condition.operator === "contains") return actualValue.includes(expectedValue);
    if (condition.operator === "not_equals") return actualValue !== expectedValue;
    return actualValue === expectedValue;
  });
}
