import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { ItalianVatLookupError, lookupItalianVatCompany } from "@/lib/italian-vat-lookup";

export async function GET(request: NextRequest) {
  // The invoice form is also used from an authorized salon PC, where there is
  // no standard Auth.js session. Resolve both normal and operational users.
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // 2. Extract VAT number from query search params
  const { searchParams } = new URL(request.url);
  const vat = searchParams.get("vat")?.replace(/\D/g, ""); // Strip non-digits

  try {
    const company = await lookupItalianVatCompany(vat);
    return NextResponse.json({ ...company, isValid: true });
  } catch (error) {
    if (error instanceof ItalianVatLookupError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("VAT lookup failed:", error);
    return NextResponse.json({ error: "Errore interno durante la verifica della Partita IVA." }, { status: 500 });
  }
}
