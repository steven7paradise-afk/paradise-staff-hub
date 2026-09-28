import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { isDisciplinaryDocument, validateDocumentBonus, applyDocumentBonus } from "@/lib/monthly-bonus-documents";
import { loadBonusState, BONUS_SETTING_PREFIX } from "@/lib/monthly-bonus-store";
import { romeBonusDay } from "@/lib/monthly-bonus";
import type { BonusState } from "@/lib/monthly-bonus-state";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { uploadEmployeeDocumentToGoogleDrive } from "@/lib/google-drive";
import { isDocumentType } from "@/lib/document-types";

const uploadRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !uploadRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.formData();
  const file = data.get("file");
  const userId = String(data.get("userId") ?? "");
  const title = String(data.get("title") ?? "").trim();
  let type = String(data.get("type") ?? "DOCUMENTO").trim().toUpperCase();
  const notes = String(data.get("notes") ?? "").trim();
  const month = Number(data.get("month") ?? 0) || null;
  const year = Number(data.get("year") ?? 0) || null;
  const documentDateValue = String(data.get("documentDate") ?? "").trim();
  const documentDate = documentDateValue ? new Date(`${documentDateValue}T12:00:00`) : null;
  const extension = file instanceof File ? file.name.split(".").pop()?.toLowerCase() : "";
  const acceptedExtensions = new Set(["pdf", "png", "jpg", "jpeg"]);
  if (!(file instanceof File) || !userId || !title || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Inserisci dipendente, titolo e file fino a 15 MB." }, { status: 400 });
  }
  if (!extension || !acceptedExtensions.has(extension)) {
    return NextResponse.json({ error: "Carica un file PDF, PNG o JPG." }, { status: 400 });
  }
  if (!isDocumentType(type)) {
    return NextResponse.json({ error: "Tipo documento non valido." }, { status: 400 });
  }
  if (notes.length > 2000) {
    return NextResponse.json({ error: "Le note non possono superare 2000 caratteri." }, { status: 400 });
  }
  if (documentDate && Number.isNaN(documentDate.getTime())) {
    return NextResponse.json({ error: "Data documento non valida." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) return NextResponse.json({ error: "Dipendente non trovato." }, { status: 404 });

  const disciplinary = isDisciplinaryDocument(type, title, file.name);
  if (disciplinary) type = "LETTERA_CONTESTAZIONE";
  const now = new Date();
  const bonusMonth = romeBonusDay(now).slice(0, 7);
  const actor = await prisma.user.findUnique({where:{id:session.user.id},select:{id:true,name:true,role:true,active:true}});
  if (!actor?.active || !uploadRoles.has(actor.role)) return NextResponse.json({error:"Non autorizzato"},{status:403});
  if (disciplinary) {
    try { validateDocumentBonus(await loadBonusState(prisma, bonusMonth), userId, actor); }
    catch (error) { return NextResponse.json({error:error instanceof Error?error.message:"Configurazione punti non disponibile."},{status:400}); }
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeTitle = title.replace(/[\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const suffix = [month ? String(month).padStart(2, "0") : "", year ?? ""].filter(Boolean).join("-");
    const fileName = `${safeTitle}${suffix ? `-${suffix}` : ""}.${extension}`;
    const driveFile = await uploadEmployeeDocumentToGoogleDrive(
      buffer,
      fileName,
      file.type || "application/pdf",
      user.name
    );
    const document = await prisma.$transaction(async tx => {
      let state: BonusState | undefined;
      const key = BONUS_SETTING_PREFIX + bonusMonth;
      if (disciplinary) {
        const initial = await loadBonusState(tx, bonusMonth);
        await tx.setting.upsert({where:{key},create:{key,value:initial as unknown as Prisma.InputJsonValue},update:{}});
        const locked = await tx.$queryRaw<Array<{value:unknown}>>`SELECT value FROM settings WHERE key = ${key} FOR UPDATE`;
        state = locked[0].value as BonusState;
        validateDocumentBonus(state,userId,actor);
      }
      const created = await tx.document.create({
      data: {
        user_id: userId,
        title,
        type,
        month,
        year,
        document_date: documentDate && !Number.isNaN(documentDate.getTime()) ? documentDate : null,
        notes: notes || null,
        uploaded_by: session.user.id,
        file_url: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
        storage_path: null,
      },
    });
      if (state) {
        const next = applyDocumentBonus(state,userId,actor,{id:created.id,title,hash:createHash('sha256').update(buffer).digest('hex')},now);
        if(next!==state) await tx.setting.update({where:{key},data:{value:next as unknown as Prisma.InputJsonValue}});
      }
      return created;
    }, {timeout:20000});
    await createNotification({ user_id: userId, title: "Nuovo documento disponibile", message: `${title} e disponibile nella sezione Documenti.`, type: "DOCUMENTO", action_url: "/documents", read: false });
    return NextResponse.json(document);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Caricamento non riuscito." }, { status: 503 });
  }
}
