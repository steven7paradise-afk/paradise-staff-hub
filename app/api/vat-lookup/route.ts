import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";

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

  if (!vat || vat.length !== 11) {
    return NextResponse.json({ error: "Partita IVA non valida. Deve essere di 11 cifre." }, { status: 400 });
  }

  try {
    // Call the European Commission's official VIES REST API for Italian VAT
    const response = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/${vat}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Impossibile contattare il servizio VIES europeo." }, { status: response.status });
    }

    const data = await response.json();
    if (!data.isValid) {
      return NextResponse.json({
        error: "Partita IVA non presente nel registro europeo VIES. Può essere valida solo in Italia: inserisci manualmente ragione sociale e indirizzo.",
      }, { status: 404 });
    }

    // Clean address format: the VIES API often returns addresses containing newlines
    let formattedAddress = data.address || "";
    if (formattedAddress) {
      formattedAddress = formattedAddress
        .replace(/\n+/g, ", ") // Replace newlines with comma
        .trim();
    }

    return NextResponse.json({
      name: data.name || "",
      address: formattedAddress,
      isValid: true,
    });

  } catch (error) {
    console.error("VAT lookup failed:", error);
    return NextResponse.json({ error: "Errore interno durante la verifica della Partita IVA." }, { status: 500 });
  }
}
