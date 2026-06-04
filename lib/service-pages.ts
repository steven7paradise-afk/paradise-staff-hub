import { CheckSquare, ClipboardList, FilePenLine } from "lucide-react";

export const servicePages = {
  1: { label: "NOTE", href: "/service-notes", icon: FilePenLine },
  2: { label: "TASK", href: "/tasks", icon: CheckSquare },
  3: { label: "FORMS", href: "/service-forms", icon: ClipboardList },
} as const;

export type ServicePageNumber = keyof typeof servicePages;

export function normalizeServicePage(page: number | string | null | undefined): ServicePageNumber {
  const value = Number(page);
  return value === 2 || value === 3 ? value : 1;
}
