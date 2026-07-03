import { NextResponse } from "next/server";
import { syncScheduleEntryToGoogleCalendar } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await syncScheduleEntryToGoogleCalendar("cmr52w341000bl709mnoc06az");
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack });
  }
}
