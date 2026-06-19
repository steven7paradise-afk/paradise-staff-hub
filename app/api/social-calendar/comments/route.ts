import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper to check access permissions
async function checkAuth(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, mansione: true }
  });
  return (
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "RESPONSABILE" ||
    (user?.mansione && user.mansione.toLowerCase().includes("social"))
  );
}

// GET: Fetch comments for a specific post
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const postId = url.searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "ID post mancante" }, { status: 400 });
    }

    const comments = await prisma.socialPostComment.findMany({
      where: { post_id: postId },
      orderBy: { created_at: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            photo_url: true,
            role: true,
            mansione: true,
          }
        }
      }
    });

    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: "Impossibile recuperare i commenti." }, { status: 500 });
  }
}

// POST: Add a new comment
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { postId, message } = body;

    if (!postId || !message || !message.trim()) {
      return NextResponse.json({ error: "ID post e messaggio sono obbligatori." }, { status: 400 });
    }

    const comment = await prisma.socialPostComment.create({
      data: {
        post_id: postId,
        user_id: session.user.id,
        message: message.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            photo_url: true,
            role: true,
            mansione: true,
          }
        }
      }
    });

    return NextResponse.json(comment);
  } catch (error) {
    return NextResponse.json({ error: "Impossibile salvare il commento." }, { status: 500 });
  }
}

// DELETE: Remove a comment
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID commento mancante" }, { status: 400 });
    }

    const comment = await prisma.socialPostComment.findUnique({
      where: { id },
    });

    if (!comment) {
      return NextResponse.json({ error: "Commento non trovato" }, { status: 404 });
    }

    // Only creator of comment or SUPER_ADMIN / ADMIN / RESPONSABILE can delete
    const isOwner = comment.user_id === session.user.id;
    const isManager = session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN" || session.user.role === "RESPONSABILE";

    if (!isOwner && !isManager) {
      return NextResponse.json({ error: "Non autorizzato a eliminare questo commento" }, { status: 403 });
    }

    await prisma.socialPostComment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Errore durante l'eliminazione del commento." }, { status: 500 });
  }
}
