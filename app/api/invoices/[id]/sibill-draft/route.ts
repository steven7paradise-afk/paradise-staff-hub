import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditForUser } from "@/lib/roles";
import { createSibillDraft, deleteSibillDraft, SIBILL_ANSWER_KEYS, SibillDraftError } from "@/lib/sibill-invoice";

type RouteParams = { params: Promise<{ id: string }> };

async function invoiceEditor() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, role: true, mansione: true, active: true },
      })
    : null;
  const canEdit = user?.active ? await canEditForUser(prisma, "/invoices", user) : false;
  return user?.id && canEdit ? user : null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await invoiceEditor();
  if (!user) {
    return NextResponse.json({ error: "Non hai il permesso di creare bozze di fattura." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findFirst({
      where: {
        id,
        form: { name: { contains: "fattura", mode: "insensitive" } },
      },
      include: { form: { select: { name: true } } },
    });

    if (!response) {
      return NextResponse.json({ error: "Richiesta di fattura non trovata." }, { status: 404 });
    }

    const answers = (response.answers as Record<string, unknown>) || {};
    const existingId = String(answers[SIBILL_ANSWER_KEYS.documentId] || "").trim();
    if (existingId) {
      return NextResponse.json({
        ok: true,
        alreadyCreated: true,
        draft: {
          id: existingId,
          status: String(answers[SIBILL_ANSWER_KEYS.documentStatus] || "DRAFT"),
          number: String(answers[SIBILL_ANSWER_KEYS.documentNumber] || ""),
          paymentStatus: String(answers[SIBILL_ANSWER_KEYS.paymentStatus] || ""),
        },
      });
    }

    const draft = await createSibillDraft({
      answers,
      responseId: response.id,
      createdAt: new Date(),
    });
    const createdAt = new Date().toISOString();
    const currentLog = Array.isArray(response.activity_log) ? response.activity_log as any[] : [];

    await prisma.serviceFormResponse.update({
      where: { id: response.id },
      data: {
        answers: {
          ...answers,
          [SIBILL_ANSWER_KEYS.documentId]: draft.id,
          [SIBILL_ANSWER_KEYS.documentStatus]: draft.status,
          [SIBILL_ANSWER_KEYS.documentNumber]: draft.number,
          [SIBILL_ANSWER_KEYS.paymentStatus]: draft.paymentStatus,
          [SIBILL_ANSWER_KEYS.draftCreatedAt]: createdAt,
        },
        activity_log: [
          ...currentLog,
          {
            type: "SIBILL_DRAFT_CREATED",
            documentId: draft.id,
            documentNumber: draft.number,
            by: user.name || "Amministrazione",
            at: createdAt,
          },
        ],
      },
    });

    return NextResponse.json({ ok: true, alreadyCreated: false, draft });
  } catch (error) {
    if (error instanceof SibillDraftError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create Sibill invoice draft:", error);
    return NextResponse.json({ error: "Impossibile creare la bozza su Sibill. Riprova tra poco." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await invoiceEditor();
  if (!user) {
    return NextResponse.json({ error: "Non hai il permesso di eliminare bozze di fattura." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findFirst({
      where: {
        id,
        form: { name: { contains: "fattura", mode: "insensitive" } },
      },
    });
    if (!response) {
      return NextResponse.json({ error: "Richiesta di fattura non trovata." }, { status: 404 });
    }

    const answers = (response.answers as Record<string, unknown>) || {};
    const documentId = String(answers[SIBILL_ANSWER_KEYS.documentId] || "").trim();
    const documentStatus = String(answers[SIBILL_ANSWER_KEYS.documentStatus] || "DRAFT").toUpperCase();
    if (!documentId) {
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }
    if (documentStatus !== "DRAFT") {
      return NextResponse.json({
        error: "Puoi eliminare da qui soltanto una bozza non ancora inviata allo SdI.",
      }, { status: 409 });
    }

    await deleteSibillDraft(documentId);
    const nextAnswers = { ...answers };
    delete nextAnswers[SIBILL_ANSWER_KEYS.documentId];
    delete nextAnswers[SIBILL_ANSWER_KEYS.documentStatus];
    delete nextAnswers[SIBILL_ANSWER_KEYS.documentNumber];
    delete nextAnswers[SIBILL_ANSWER_KEYS.paymentStatus];
    delete nextAnswers[SIBILL_ANSWER_KEYS.draftCreatedAt];
    const deletedAt = new Date().toISOString();
    const currentLog = Array.isArray(response.activity_log) ? response.activity_log as any[] : [];

    await prisma.serviceFormResponse.update({
      where: { id: response.id },
      data: {
        answers: nextAnswers as Prisma.InputJsonValue,
        activity_log: [
          ...currentLog,
          {
            type: "SIBILL_DRAFT_DELETED",
            documentId,
            by: user.name || "Amministrazione",
            at: deletedAt,
          },
        ],
      },
    });

    return NextResponse.json({ ok: true, alreadyDeleted: false });
  } catch (error) {
    if (error instanceof SibillDraftError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete Sibill invoice draft:", error);
    return NextResponse.json({ error: "Impossibile eliminare la bozza su Sibill. Riprova tra poco." }, { status: 500 });
  }
}
