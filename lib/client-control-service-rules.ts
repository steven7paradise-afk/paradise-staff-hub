export const CLIENT_CONTROL_SERVICE_OPTIONS = [
  "Applicazione",
  "Riapplicazione",
  "Sistemazione fasce",
  "Rimozione",
  "Piega",
  "Taglio",
  "Microcheratina",
  "Nanoplastia",
  "Colore",
] as const;

export type ClientControlService = (typeof CLIENT_CONTROL_SERVICE_OPTIONS)[number];

function normalizeService(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/\s+/g, " ")
    .trim();
}

export function allowsMissingFinalPaymentOrder(services: unknown): boolean {
  const values = Array.isArray(services) ? services : services ? [services] : [];
  return values.some((service) => /^sistemazione\s+fasc(?:e|ia)$/.test(normalizeService(service)));
}
