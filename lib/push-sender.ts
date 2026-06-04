import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let vapidInitialized = false;

async function initVapid() {
  if (vapidInitialized) return;

  let publicKey = process.env.NEXT_PUBLIC_VAPID_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    // If not in env, check or create in Settings DB
    const record = await prisma.setting.findUnique({ where: { key: "vapid_keys" } });
    if (record) {
      const keys = record.value as { publicKey: string; privateKey: string };
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
    } else {
      const keys = webpush.generateVAPIDKeys();
      await prisma.setting.create({
        data: {
          key: "vapid_keys",
          value: {
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
          },
        },
      });
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
    }
  }

  webpush.setVapidDetails(
    "mailto:support@paradisebeauty.it",
    publicKey,
    privateKey,
  );
  vapidInitialized = true;
}

export async function getPublicVapidKey() {
  await initVapid();
  let publicKey = process.env.NEXT_PUBLIC_VAPID_KEY;
  if (!publicKey) {
    const record = await prisma.setting.findUnique({ where: { key: "vapid_keys" } });
    publicKey = (record?.value as any)?.publicKey;
  }
  return publicKey || "";
}

export async function sendPushNotification(userId: string, title: string, message: string, actionUrl?: string) {
  await initVapid();

  const record = await prisma.setting.findUnique({ where: { key: "push_subscriptions" } });
  const list = Array.isArray(record?.value) ? record.value : [];
  const userSubs = list.filter((item: any) => item.userId === userId);

  const payload = JSON.stringify({
    title,
    message,
    actionUrl,
  });

  const promises = userSubs.map(async (item: any) => {
    try {
      await webpush.sendNotification(item.subscription, payload);
    } catch (error: any) {
      console.error("Web Push sending error endpoint:", item.subscription.endpoint, error.statusCode);
      // If subscription expired or disabled, remove it
      if (error.statusCode === 410 || error.statusCode === 404) {
        const latest = await prisma.setting.findUnique({ where: { key: "push_subscriptions" } });
        let currentList = Array.isArray(latest?.value) ? latest.value : [];
        currentList = currentList.filter((sub: any) => sub.subscription.endpoint !== item.subscription.endpoint);
        await prisma.setting.update({
          where: { key: "push_subscriptions" },
          data: { value: currentList },
        });
      }
    }
  });

  await Promise.allSettled(promises);
}
