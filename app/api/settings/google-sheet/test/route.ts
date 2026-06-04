import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendAttendanceToGoogleSheet } from "@/lib/google-sheet";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const result = await appendAttendanceToGoogleSheet({
      date: new Date().toLocaleDateString("it-IT"),
      time: new Date().toLocaleTimeString("it-IT"),
      employeeName: "Test Connessione",
      employeeEmail: "admin@staff-paradise.it",
      locationName: "Salone Centrale",
      type: "TEST_CONNESSIONE",
      deviceName: "Server Hub Test",
      note: "Test di sincronizzazione API riuscito",
    });

    if (result.skipped) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Errore sconosciuto" }, { status: 500 });
  }
}
