import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSocialPostToGoogleCalendar, deleteSocialPostFromGoogleCalendar } from "@/lib/google-calendar";

// Helper to check access permissions
async function checkAuth(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, mansione: true }
  });
  return (
    user?.role === "ZERO" || user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "RESPONSABILE" ||
    (user?.mansione && user.mansione.toLowerCase().includes("social"))
  );
}

// GET: Fetch all posts
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato. Permessi insufficienti." }, { status: 403 });
  }

  try {
    const posts = await prisma.socialPost.findMany({
      orderBy: { scheduled_at: "asc" },
      include: {
        created_by: {
          select: {
            id: true,
            name: true,
            photo_url: true,
          }
        }
      }
    });

    return NextResponse.json(posts);
  } catch (error) {
    return NextResponse.json({ error: "Impossibile recuperare i post social." }, { status: 500 });
  }
}

// POST: Create a new post
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato. Permessi insufficienti." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, description, scheduledAt, platform, status, coverUrl, videoUrl, notes, brand } = body;

    if (!title || !scheduledAt || !platform) {
      return NextResponse.json({ error: "Titolo, data e piattaforma sono campi obbligatori." }, { status: 400 });
    }

    const post = await prisma.socialPost.create({
      data: {
        title,
        description: description || null,
        scheduled_at: new Date(scheduledAt),
        platform,
        status: status || "DRAFT",
        cover_url: coverUrl || null,
        video_url: videoUrl || null,
        notes: notes || null,
        brand: brand || "PARADISE",
        created_by_id: session.user.id,
      },
      include: {
        created_by: {
          select: {
            id: true,
            name: true,
            photo_url: true,
          }
        }
      }
    });

    // Sync to Google Calendar in the background
    void syncSocialPostToGoogleCalendar(post.id);

    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: "Errore durante la creazione del post." }, { status: 500 });
  }
}

// PUT: Update an existing post
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato. Permessi insufficienti." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, title, description, scheduledAt, platform, status, coverUrl, videoUrl, notes, brand } = body;

    if (!id || !title || !scheduledAt || !platform) {
      return NextResponse.json({ error: "ID, titolo, data e piattaforma sono obbligatori per l'aggiornamento." }, { status: 400 });
    }

    const post = await prisma.socialPost.update({
      where: { id },
      data: {
        title,
        description: description || null,
        scheduled_at: new Date(scheduledAt),
        platform,
        status,
        cover_url: coverUrl || null,
        video_url: videoUrl || null,
        notes: notes || null,
        brand: brand || "PARADISE",
      },
      include: {
        created_by: {
          select: {
            id: true,
            name: true,
            photo_url: true,
          }
        }
      }
    });

    // Sync to Google Calendar in the background
    void syncSocialPostToGoogleCalendar(post.id);

    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: "Errore durante l'aggiornamento del post." }, { status: 500 });
  }
}

// DELETE: Delete a post
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const isAllowed = await checkAuth(session.user.id);
  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato. Permessi insufficienti." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID post mancante." }, { status: 400 });
    }

    const post = await prisma.socialPost.findUnique({
      where: { id },
      select: { google_calendar_event_id: true }
    });

    await prisma.socialPost.delete({
      where: { id },
    });

    if (post?.google_calendar_event_id) {
      void deleteSocialPostFromGoogleCalendar(post.google_calendar_event_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Errore durante l'eliminazione del post." }, { status: 500 });
  }
}
