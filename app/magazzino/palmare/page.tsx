import { redirect } from "next/navigation";
import { WarehouseHandheldApp } from "@/components/warehouse-handheld-app";
import { auth } from "@/lib/auth";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { getWarehouseState, type WarehouseOrder } from "@/lib/internal-warehouse";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function answerText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.name ?? record.fileName ?? record.url ?? record.driveFileUrl ?? "");
  }
  return String(value);
}

function productLines(value: unknown) {
  const text = answerText(value);
  const serviceWords = [
    "riapplicazione",
    "rimozione",
    "rimuoviamo",
    "lavaggio",
    "piega",
    "taglio",
    "consulenza",
    "acconto",
    "paradise pos",
  ];

  return text
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !serviceWords.some((word) => item.toLowerCase().includes(word)));
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" }).format(date);
}

export default async function MagazzinoPalmarePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [warehouseState, responses] = await Promise.all([
    getWarehouseState(),
    prisma.serviceFormResponse
      .findMany({
        where: {
          form: {
            OR: [
              { name: { contains: "controllo cliente", mode: "insensitive" } },
              { category: { contains: "qualita", mode: "insensitive" } },
            ],
          },
        },
        include: {
          form: { select: { name: true, category: true } },
          user: { select: { name: true } },
        },
        orderBy: { created_at: "desc" },
        take: 500,
      })
      .catch(() => []),
  ]);

  const orders: WarehouseOrder[] = responses
    .filter((response) => isClientControlFormName(response.form?.name, response.form?.category))
    .filter((response) => productLines((response.answers as Record<string, unknown>)?.[CLIENT_CONTROL_FIELD_IDS.productsList]).length > 0)
    .map((response) => {
      const answers = (response.answers as Record<string, unknown>) || {};
      return {
        id: response.id,
        clientName: answerText(answers[CLIENT_CONTROL_FIELD_IDS.clientName]),
        orderNumber: answerText(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder]),
        salon: answerText(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name) || "Senza salone",
        products: productLines(answers[CLIENT_CONTROL_FIELD_IDS.productsList]),
        paid: answerText(answers[CLIENT_CONTROL_FIELD_IDS.paid]),
        dateKey: dateKey(response.created_at),
        dateLabel: dateLabel(response.created_at),
        createdAt: response.created_at.toISOString(),
        userName: response.user?.name || "Staff",
      };
    });

  return <WarehouseHandheldApp initialState={warehouseState} orders={orders} userName={session.user.name || "Paradise Staff"} />;
}
