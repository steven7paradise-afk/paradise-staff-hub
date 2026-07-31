import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { backupDatabaseToGoogleSheet } from "@/lib/google-sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ZERO") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const result = await backupDatabaseToGoogleSheet();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Google Sheet database backup failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Backup Google Sheet non riuscito.",
      },
      { status: 500 },
    );
  }
}
