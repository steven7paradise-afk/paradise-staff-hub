import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_SETTINGS_KEY = "dashboard_settings";

export const DEFAULT_DASHBOARD_SETTINGS = {
  salonGoal: 500,
  workerGoal: 100,
  workerBonusMap: {} as Record<string, { manualBonusPoints?: number; redeemedPoints?: number }>,
  promos: [
    {
      id: "promo-1",
      title: "LUGLIO GLOW -20% CHERATINA",
      subtitle: "PROMO DELLA SETTIMANA",
      description: "Tutti i trattamenti di cheratina e ristrutturazione a -20%. Proponilo alle clienti con colore o schiariture: massimo effetto, upsell naturale.",
      badge: "VALIDA FINO AL 31 LUGLIO",
      expirationDate: "2026-07-31",
      ctaText: "CONDIVIDI COL CLIENTE",
      ctaUrl: "/service-forms",
      materialeGraficoUrl: "/documents",
      active: true,
      image: ""
    },
    {
      id: "promo-2",
      title: "SUMMER APP",
      subtitle: "OFFERTA SPECIALE",
      description: "Per lunghezze da 55 cm. La tua trasformazione Paradise con uno sconto esclusivo per l'estate.",
      badge: "VALIDA FINO A FINE MESE",
      expirationDate: "2026-08-31",
      ctaText: "SCOPRI DI PIÙ",
      ctaUrl: "/client-control",
      materialeGraficoUrl: "/documents",
      active: true,
      image: ""
    }
  ],
  sideCard1: {
    category: "PORTA UN'AMICA",
    title: "PIEGA IN OMAGGIO",
    badge: "x2",
    description: "NUOVA CLIENTE PRESENTATA = PIEGA GRATIS",
    url: "/client-control",
  },
  sideCard2: {
    category: "LOYALTY · PARADISE CARD",
    title: "PUNTI DOPPI",
    badge: "◆",
    description: "SU TUTTI I PRODOTTI RETAIL FINO A DOMENICA",
    url: "/tables",
  },
  productOfMonth: {
    title: "PRO-GLOW SERUM",
    subtitle: "CONSIGLIATO • UPSELL",
    description: "Siero termoprotettivo. Perfetto da abbinare a ogni cheratina — provalo sulla cliente a fine servizio.",
    originalPrice: 32,
    discountPrice: 26,
    badge: "RETAIL",
    image: ""
  },
  communications: [
    {
      id: "comm-1",
      title: "Nuovo protocollo cheratina",
      detail: "Da oggi si usa la linea Pro-Glow. Scheda tecnica nei documenti.",
      tag: "DIREZIONE • 2 ORE FA"
    },
    {
      id: "comm-2",
      title: "Riunione staff venerdì 25",
      detail: "Ore 18:30 dopo chiusura. Presenza obbligatoria.",
      tag: "DIREZIONE • IERI"
    },
    {
      id: "comm-3",
      title: "Consegna ordine prodotti",
      detail: "Arrivato il rifornimento retail: sistemare espositori.",
      tag: "MAGAZZINO • 2 GIORNI FA"
    }
  ]
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: DASHBOARD_SETTINGS_KEY }
    });

    if (!setting) {
      return NextResponse.json(DEFAULT_DASHBOARD_SETTINGS);
    }

    const val = setting.value as any;
    return NextResponse.json({
      salonGoal: Number(val?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal,
      workerGoal: Number(val?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal,
      workerBonusMap: val?.workerBonusMap && typeof val.workerBonusMap === "object" ? val.workerBonusMap : {},
      promos: Array.isArray(val?.promos) ? val.promos : DEFAULT_DASHBOARD_SETTINGS.promos,
      sideCard1: val?.sideCard1 || DEFAULT_DASHBOARD_SETTINGS.sideCard1,
      sideCard2: val?.sideCard2 || DEFAULT_DASHBOARD_SETTINGS.sideCard2,
      productOfMonth: val?.productOfMonth || DEFAULT_DASHBOARD_SETTINGS.productOfMonth,
      communications: Array.isArray(val?.communications) ? val.communications : DEFAULT_DASHBOARD_SETTINGS.communications,
    });
  } catch (error: any) {
    console.error("Failed to load dashboard settings:", error);
    return NextResponse.json(DEFAULT_DASHBOARD_SETTINGS);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true }
  });

  const role = dbUser?.role || session.user.role;
  if (role !== "ZERO" && role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
  }

  try {
    const body = await req.json();
    
    const cleanSettings = {
      salonGoal: Math.max(1, Number(body.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal),
      workerGoal: Math.max(1, Number(body.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal),
      workerBonusMap: body.workerBonusMap && typeof body.workerBonusMap === "object" ? body.workerBonusMap : {},
      promos: Array.isArray(body.promos) ? body.promos : DEFAULT_DASHBOARD_SETTINGS.promos,
      sideCard1: body.sideCard1 || DEFAULT_DASHBOARD_SETTINGS.sideCard1,
      sideCard2: body.sideCard2 || DEFAULT_DASHBOARD_SETTINGS.sideCard2,
      productOfMonth: body.productOfMonth || DEFAULT_DASHBOARD_SETTINGS.productOfMonth,
      communications: Array.isArray(body.communications) ? body.communications : DEFAULT_DASHBOARD_SETTINGS.communications,
    };

    const setting = await prisma.setting.upsert({
      where: { key: DASHBOARD_SETTINGS_KEY },
      create: {
        key: DASHBOARD_SETTINGS_KEY,
        value: cleanSettings,
      },
      update: {
        value: cleanSettings,
      }
    });

    // Revalidate paths so changes show instantly
    try {
      revalidatePath("/dashboard");
      revalidatePath("/settings/dashboard");
      revalidatePath("/", "layout");
    } catch (revalError) {
      console.warn("Revalidation warning:", revalError);
    }

    return NextResponse.json({ success: true, settings: setting.value });
  } catch (error: any) {
    console.error("Failed to save dashboard settings:", error);
    return NextResponse.json({ error: error.message || "Errore durante il salvataggio" }, { status: 500 });
  }
}
