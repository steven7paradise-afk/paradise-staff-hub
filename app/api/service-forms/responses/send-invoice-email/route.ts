import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadInvoicePdf } from "@/lib/supabase-storage";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const data = await request.formData();
    const file = data.get("file");
    const email = data.get("email");
    const idsString = data.get("ids");
    const dateRangeStr = data.get("dateRangeStr") || "Periodo Selezionato";
    const pendingTotalString = data.get("pendingTotal") || "0.00";

    if (!(file instanceof File) || !email || !idsString) {
      return NextResponse.json({ error: "Dati o file mancanti." }, { status: 400 });
    }

    const ids = JSON.parse(idsString as string);
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Nessun ID fattura valido fornito." }, { status: 400 });
    }

    // 1. Upload PDF file to Supabase
    const bytes = await file.arrayBuffer();
    const pdfUrl = await uploadInvoicePdf(session.user.id, file.name, bytes);

    // 2. Send email via Resend/Brevo
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="background-color: #F7E9EF; color: #A74758; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">ROSA FRANCESCA S.R.L.</span>
        </div>
        <h2 style="color: #1F1F1F; margin-top: 10px; margin-bottom: 4px; font-size: 20px; font-weight: 800; text-align: center; letter-spacing: -0.02em;">Riepilogo Richieste Fatture</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 16px; margin-bottom: 16px; text-align: center;">
          Ciao, in calce trovi il link per scaricare e visualizzare il documento PDF cumulativo contenente le richieste di fatturazione elettronica per il periodo <strong>${dateRangeStr}</strong>.
        </p>
        
        <div style="background-color: #F8FAFC; border-radius: 16px; padding: 20px; border: 1px solid #E2E8F0; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #1F1F1F;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569; width: 150px;">Fatture incluse:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #A74758;">${ids.length}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569;">Importo totale:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F;">€ ${pendingTotalString}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569;">Periodo:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F;">${dateRangeStr}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${pdfUrl}" target="_blank" style="display: inline-block; background-color: #A74758; color: #ffffff; padding: 12px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(167, 71, 88, 0.15);">Visualizza / Scarica PDF</a>
        </div>

        <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Generato automaticamente da Staff Hub per ROSA FRANCESCA S.R.L.
        </p>
      </div>
    `;

    await sendEmail({
      to: (email as string).trim(),
      subject: `Richiesta Richiesta Richieste di Fatture ROSA FRANCESCA SRL dal ${dateRangeStr}`,
      html: emailHtml,
    });

    // 3. Bulk update invoice statuses to 'EMESSA' in the database
    await prisma.serviceFormResponse.updateMany({
      where: { id: { in: ids } },
      data: { status: "EMESSA" }
    });

    return NextResponse.json({ success: true, pdfUrl });
  } catch (err: any) {
    console.error("Invoice send error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
