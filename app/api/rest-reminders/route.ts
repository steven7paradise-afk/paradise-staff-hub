import { NextResponse } from "next/server";
import { ensureTomorrowRestNotifications } from "@/lib/rest-notifications";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    return NextResponse.json(await ensureTomorrowRestNotifications());
  } catch (error) {
    console.error("Rest reminder check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invio promemoria riposo non riuscito." },
      { status: 500 },
    );
  }
}
