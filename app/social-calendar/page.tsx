import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { SocialCalendar } from "@/components/social-calendar";

export const dynamic = "force-dynamic";

export default async function SocialCalendarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, mansione: true }
  });

  const isAllowed =
    user?.role === "ZERO" || user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "RESPONSABILE" ||
    (user?.mansione && user.mansione.toLowerCase().includes("social"));

  if (!isAllowed) {
    redirect("/dashboard");
  }

  // Fetch initial posts list
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

  // Map Date objects to string for client component serialization
  const serializedPosts = posts.map((post) => ({
    ...post,
    scheduled_at: post.scheduled_at.toISOString(),
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
  }));

  return (
    <AppShell title="Programmazione Social" subtitle="Organizza, pianifica e gestisci la pubblicazione dei video e dei contenuti per i tuoi canali social.">
      <SocialCalendar initialPosts={serializedPosts} currentUserId={session.user.id} />
    </AppShell>
  );
}
