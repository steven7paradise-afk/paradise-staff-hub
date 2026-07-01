
export const servicePages = {
  1: { label: "NOTE", href: "/service-notes", iconName: "FilePenLine" },
  2: { label: "Task", href: "/tasks", iconName: "CheckSquare" },
  3: { label: "Cassa", href: "/service-forms", iconName: "ReceiptText" },
} as const;

export type ServicePageNumber = keyof typeof servicePages;

export function normalizeServicePage(page: number | string | null | undefined): ServicePageNumber {
  const value = Number(page);
  return value === 2 || value === 3 ? value : 1;
}
