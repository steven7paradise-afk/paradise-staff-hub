import { getSocialAudience } from "./social-audience";

const audienceGlobal = globalThis as typeof globalThis & {
  socialAudienceTimer?: ReturnType<typeof setInterval>;
};

export function startSocialAudienceScheduler() {
  if (audienceGlobal.socialAudienceTimer || !process.env.APIFY_API_TOKEN) return;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await getSocialAudience(); }
    catch { console.error("Social audience: refresh failed; retrying next cycle."); }
    finally { busy = false; }
  };
  audienceGlobal.socialAudienceTimer = setInterval(() => void run(), 300_000);
  audienceGlobal.socialAudienceTimer.unref();
  void run();
}
