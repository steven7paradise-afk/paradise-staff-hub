import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadOrderImage } from "@/lib/supabase-storage";

const ORDER_PHOTO_KEY = "__orderPhoto";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: { id: true, answers: true },
    });

    if (!response) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
    }

    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Carica un'immagine valida fino a 10 MB." }, { status: 400 });
    }

    const url = await uploadOrderImage(session.user.id, id, file);
    const currentAnswers =
      response.answers && typeof response.answers === "object" && !Array.isArray(response.answers)
        ? (response.answers as Record<string, unknown>)
        : {};

    const photo = {
      url,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.user.name || "Staff",
    };

    const updated = await prisma.serviceFormResponse.update({
      where: { id },
      data: {
        answers: {
          ...currentAnswers,
          [ORDER_PHOTO_KEY]: photo,
        },
      },
      include: {
        user: true,
        form: true,
      },
    });

    return NextResponse.json({ photo, order: updated });
  } catch (error) {
    console.error("Failed to upload order image:", error);
    return NextResponse.json({ error: "Errore durante il caricamento della foto." }, { status: 500 });
  }
}
