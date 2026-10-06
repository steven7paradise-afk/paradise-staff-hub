import { prisma } from "@/lib/prisma";
import { dueSocialPostsWhere } from "./social-post-schedule";

export async function reconcileScheduledSocialPosts(now = new Date()) {
  // Atomic predicate makes concurrent server instances and repeated checks safe.
  return prisma.socialPost.updateMany({ where: dueSocialPostsWhere(now), data: { status: "PUBLISHED" } });
}

const schedulerGlobal = globalThis as typeof globalThis & { socialPostTimer?: ReturnType<typeof setInterval> };
export function startSocialPostScheduler() {
  if (schedulerGlobal.socialPostTimer) return;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await reconcileScheduledSocialPosts();


    }
    catch { console.error("Social calendar: automatic status update failed; retrying on next cycle."); }
    finally { busy = false; }
  };
  schedulerGlobal.socialPostTimer = setInterval(() => void run(), 30_000);
  schedulerGlobal.socialPostTimer.unref();
  void run();
}
