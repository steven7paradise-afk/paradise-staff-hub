import { NextResponse } from "next/server";
import { ensureContractExpiryNotifications } from "@/lib/contract-notifications";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  try {
    return NextResponse.json(await ensureContractExpiryNotifications());
  } catch (error) {
    console.error("Contract reminder check failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Controllo promemoria non riuscito." }, { status: 500 });
  }
}
