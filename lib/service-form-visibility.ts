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
