import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { getOperationalUser } from "@/lib/operational-session";

export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function moneyText(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";
  const number = Number(text.replace(",", "."));
  if (!Number.isFinite(number)) return text;
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(number);
}

function normalizeStaffNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 6);
}

function checksText(checks: any) {
  const items = [
    checks?.notes ? "note Shopify compilate" : "",
    checks?.beforeMedia ? "foto/video prima eseguite" : "",
    checks?.afterMedia ? "foto/video dopo eseguite" : "",
    checks?.products ? "prodotti registrati" : "",
    checks?.review ? "recensione gestita" : "",
  ].filter(Boolean);
  return items.join(", ");
}

function composeRawNote(input: {
  note: string;
  clientName: string;
  serviceTitle: string;
  orderNumber: string;
  salon: string;
  depositPaid: string;
  paid: string;
  instagramTag: string;
  staffNames: string[];
  checks: string;
}) {
  return [
    input.orderNumber ? `Ordine ${input.orderNumber.replace(/^#/, "")}.` : "",
    input.clientName ? `Cliente ${input.clientName}.` : "",
    input.serviceTitle ? `Servizio effettuato: ${input.serviceTitle}.` : "",
    input.staffNames.length ? `Servizio seguito da ${input.staffNames.join(", ")}.` : "",
    input.salon ? `Sede: ${input.salon}.` : "",
    input.depositPaid ? `Acconto pagato: ${input.depositPaid}.` : "",
    input.paid ? `Importo pagato oggi: ${input.paid}.` : "",
    input.instagramTag ? `Instagram: ${input.instagramTag}.` : "",
    input.checks ? `Controlli eseguiti: ${input.checks}.` : "",
    input.note ? `Osservazioni: ${input.note}.` : "",
  ].filter(Boolean).join(" ");
}

function localPolish(rawNote: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bcliente\s+antipatica\b/gi, "cliente poco collaborativa"],
    [/\bantipatica\b/gi, "poco collaborativa"],
    [/\bsimpatica\b/gi, "cordiale"],
    [/\barrivata?\s+in\s+ritardo\b/gi, "cliente arrivata in ritardo"],
    [/\bcapelli\s+molto\s+sottile\b/gi, "capelli molto sottili"],
    [/\berano\s+poco\s+curato\b/gi, "capelli poco curati"],
  ];

  let note = rawNote;
  replacements.forEach(([pattern, replacement]) => {
    note = note.replace(pattern, replacement);
  });

  return note
    .split(/[.;]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(". ");
}

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
  const pcAuth = pcToken ? await checkPCAuthorization(pcToken).catch(() => null) : null;
  const requestedDevice = cookieStore.get(tabletDeviceCookieName)?.value ?? request.headers.get("x-device-id") ?? "";
  const tabletDevice = requestedDevice
    ? await authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)).catch(() => null)
    : null;
  const canUseFromDashboard = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(String(operationalUser?.role ?? ""));

  if (!tabletDevice && !canUseFromDashboard && !pcAuth) {
    return NextResponse.json({ error: "Tablet non autorizzato." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const note = cleanText(body?.note).slice(0, 1200);
  const clientName = cleanText(body?.clientName).slice(0, 120);
  const serviceTitle = cleanText(body?.serviceTitle).slice(0, 160);
  const orderNumber = cleanText(body?.orderNumber).slice(0, 60);
  const salon = cleanText(body?.salon).slice(0, 120);
  const depositPaid = moneyText(body?.depositPaid).slice(0, 60);
  const paid = moneyText(body?.paid).slice(0, 60);
  const instagramTag = cleanText(body?.instagramTag).slice(0, 80);
  const staffNames = normalizeStaffNames(body?.staffNames);
  const checks = checksText(body?.checks);
  const rawNote = composeRawNote({
    note,
    clientName,
    serviceTitle,
    orderNumber,
    salon,
    depositPaid,
    paid,
    instagramTag,
    staffNames,
    checks,
  }).slice(0, 1800);

  if (!rawNote) {
    return NextResponse.json({ error: "Inserisci almeno un dato del modulo." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ note: localPolish(rawNote), mode: "local" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_NOTE_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Prepara una nota Shopify interna per un salone beauty. Scrivi in italiano professionale, breve e chiaro, in 3-5 frasi. Mantieni tutti i dati presenti: ordine, cliente, servizio, collaboratori, acconto/importi, controlli foto/note/prodotti/recensione. Togli toni offensivi e usa formulazioni neutrali. Non inventare informazioni. Restituisci solo la nota finale.",
          },
          {
            role: "user",
            content: [
              clientName ? `Cliente: ${clientName}` : "",
              serviceTitle ? `Servizio: ${serviceTitle}` : "",
              orderNumber ? `Ordine: ${orderNumber}` : "",
              staffNames.length ? `Collaboratori: ${staffNames.join(", ")}` : "",
              depositPaid ? `Acconto: ${depositPaid}` : "",
              paid ? `Pagato oggi: ${paid}` : "",
              checks ? `Controlli: ${checks}` : "",
              `Nota grezza completa: ${rawNote}`,
            ].filter(Boolean).join("\n"),
          },
        ],
        max_output_tokens: 260,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("OpenAI note polish failed:", data);
      return NextResponse.json({ note: localPolish(rawNote), mode: "local" });
    }

    const polished =
      data?.output_text ??
      data?.output?.flatMap((item: any) => item?.content ?? [])
        ?.map((item: any) => item?.text ?? "")
        ?.join(" ")
        ?.trim();

    return NextResponse.json({ note: cleanText(polished) || localPolish(rawNote), mode: polished ? "ai" : "local" });
  } catch (error) {
    console.error("Failed to polish appointment note:", error);
    return NextResponse.json({ note: localPolish(rawNote), mode: "local" });
  }
}
