import type { Role } from "@/lib/roles";

export const ASSISTANCE_TABLES_KEY = "assistance_tables";
export const ASSISTANCE_TABLES_ACCESS_KEY = "assistance_tables_access";

export type AssistanceAttachment = {
  name: string;
  url: string;
  type?: string;
};

export type AssistanceColumnType = "text" | "image" | "file";

export type AssistanceCellValue = string | AssistanceAttachment | null;

export type AssistanceTableRow = {
  id: string;
  nome: string;
  cognome: string;
  testo: string;
  image: AssistanceAttachment | null;
  file: AssistanceAttachment | null;
  values: Record<string, AssistanceCellValue>;
  createdAt: string;
  updatedAt: string;
};

export type AssistanceTableColumn = {
  id: string;
  label: string;
  type: AssistanceColumnType;
};

export type AssistanceSheet = {
  id: string;
  name: string;
  columns: AssistanceTableColumn[];
  createdAt: string;
  updatedAt: string;
  rows: AssistanceTableRow[];
};

export type AssistanceTablesAccess = {
  roles: Role[];
  userIds: string[];
  allowMansioneAssistenza: boolean;
};

export function normalizeAssistanceTablesAccess(value: unknown): AssistanceTablesAccess {
  const allowedRoles: Role[] = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
  const defaultRoles: Role[] = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      roles: defaultRoles,
      userIds: [],
      allowMansioneAssistenza: true,
    };
  }
  const data = value as Record<string, unknown>;
  const roles = Array.isArray(data.roles)
    ? data.roles.filter((role): role is Role => allowedRoles.includes(role as Role))
    : defaultRoles;
  const userIds = Array.isArray(data.userIds)
    ? data.userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  return {
    roles,
    userIds,
    allowMansioneAssistenza: data.allowMansioneAssistenza !== false,
  };
}

export function canUseAssistanceTables(
  role?: Role | string,
  mansione?: string | null,
  userId?: string | null,
  access?: AssistanceTablesAccess,
) {
  const rules = access ?? normalizeAssistanceTablesAccess(null);
  return (
    rules.roles.includes(role as Role) ||
    (userId ? rules.userIds.includes(userId) : false) ||
    (rules.allowMansioneAssistenza && (mansione ?? "").toLowerCase().includes("assistenza"))
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function attachment(value: unknown): AssistanceAttachment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const name = text(item.name).trim();
  const url = text(item.url);
  if (!name || !url) return null;
  return { name, url, type: text(item.type) || undefined };
}

function values(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => typeof key === "string" && key.length > 0)
      .map(([key, val]) => [key, attachment(val) ?? text(val)])
  );
}

function columnType(value: unknown): AssistanceColumnType {
  return value === "image" || value === "file" ? value : "text";
}

function columns(value: unknown): AssistanceTableColumn[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((column) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) return null;
      const c = column as Record<string, unknown>;
      const id = text(c.id).trim();
      const label = text(c.label).trim();
      if (!id || !label) return null;
      return { id, label, type: columnType(c.type) };
    })
    .filter(Boolean) as AssistanceTableColumn[];
}

export function normalizeAssistanceSheets(value: unknown): AssistanceSheet[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((sheet, index) => {
      if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) return null;
      const item = sheet as Record<string, unknown>;
      const now = new Date().toISOString();
      const rowsValue = Array.isArray(item.rows) ? item.rows : [];
      const rows = rowsValue
        .map((row) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) return null;
          const r = row as Record<string, unknown>;
          return {
            id: text(r.id) || crypto.randomUUID(),
            nome: text(r.nome).trim(),
            cognome: text(r.cognome).trim(),
            testo: text(r.testo),
            image: attachment(r.image),
            file: attachment(r.file),
            values: values(r.values),
            createdAt: text(r.createdAt) || now,
            updatedAt: text(r.updatedAt) || now,
          };
        })
        .filter(Boolean) as AssistanceTableRow[];

      return {
        id: text(item.id) || crypto.randomUUID(),
        name: text(item.name).trim() || `Sheet ${index + 1}`,
        columns: columns(item.columns),
        createdAt: text(item.createdAt) || now,
        updatedAt: text(item.updatedAt) || now,
        rows,
      };
    })
    .filter(Boolean) as AssistanceSheet[];
}

export function defaultAssistanceSheet(): AssistanceSheet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Clienti",
    columns: [],
    createdAt: now,
    updatedAt: now,
    rows: [],
  };
}
