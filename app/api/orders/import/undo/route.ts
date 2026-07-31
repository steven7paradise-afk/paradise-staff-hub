import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const role = session.user.role;
    const canManageOrders =
      ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role) ||
      session.user.id === "cmpo4y9900001jr09bg1dnqxs" ||
      session.user.id === "cmpms4o9h0003l809zof30mni" ||
      !!session.user.email?.toLowerCase().includes("jessica") ||
      !!session.user.email?.toLowerCase().includes("darwin");

    if (!canManageOrders) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    // Get the most recent responses to analyze
    const responses = await prisma.serviceFormResponse.findMany({
      orderBy: { updated_at: "desc" },
      take: 200,
    });

    // Filter responses that were imported from CSV
    const importedResponses = responses.filter((res) => {
      const log = Array.isArray(res.activity_log) ? res.activity_log : [];
      return log.some((l: any) => 
        l.action === "Ordine importato da CSV" || 
        l.note === "Ordine importato da CSV"
      );
    });

    if (importedResponses.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "Nessun ordine importato trovato da eliminare." });
    }

    // Find the latest import log timestamp
    let latestLogTime = 0;
    for (const res of importedResponses) {
      const log = Array.isArray(res.activity_log) ? (res.activity_log as any[]) : [];
      const importLog = log.find((l: any) => l.note === "Ordine importato da CSV" || l.action === "Ordine importato da CSV");
      if (importLog) {
        const logTime = new Date(importLog.at || importLog.date || res.updated_at).getTime();
        if (logTime > latestLogTime) {
          latestLogTime = logTime;
        }
      }
    }

    if (latestLogTime === 0) {
      return NextResponse.json({ success: true, count: 0, message: "Nessun ordine importato trovato da eliminare." });
    }

    // Group orders imported around the same time (within a 10-minute window of the latest import log)
    const tenMinutes = 10 * 60 * 1000;
    const targetsToDelete = importedResponses.filter((res) => {
      const log = Array.isArray(res.activity_log) ? (res.activity_log as any[]) : [];
      const importLog = log.find((l: any) => l.note === "Ordine importato da CSV" || l.action === "Ordine importato da CSV");
      if (importLog) {
        const logTime = new Date(importLog.at || importLog.date || res.updated_at).getTime();
        return Math.abs(latestLogTime - logTime) < tenMinutes;
      }
      return false;
    });

    // Delete them
    const deletedCount = await prisma.serviceFormResponse.deleteMany({
      where: {
        id: {
          in: targetsToDelete.map((t) => t.id),
        },
      },
    });

    return NextResponse.json({ success: true, count: deletedCount.count });
  } catch (error) {
    console.error("Errore durante l'annullamento dell'importazione:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione" }, { status: 500 });
  }
}
