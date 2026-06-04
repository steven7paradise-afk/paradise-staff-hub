const GRAPH_VERSION = "v21.0";

function normalizePhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("39")) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `39${digits}`;
  return digits.length >= 8 ? digits : "";
}

function appUrl(path?: string | null) {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://paradise-staff-hub.netlify.app";
  if (!path) return base;
  if (path.startsWith("http")) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendWhatsAppMessage({
  to,
  title,
  message,
  actionUrl,
}: {
  to: string | null | undefined;
  title: string;
  message: string;
  actionUrl?: string | null;
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = normalizePhone(to);

  if (!token || !phoneNumberId || !recipient) {
    return { skipped: true, reason: !recipient ? "Numero WhatsApp mancante" : "WhatsApp non configurato" };
  }

  const body = [`*${title}*`, message, actionUrl ? `\nApri: ${appUrl(actionUrl)}` : ""].filter(Boolean).join("\n");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { preview_url: true, body },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("WhatsApp notification failed", error);
    return { skipped: true, reason: "Invio WhatsApp non riuscito" };
  }

  return { skipped: false };
}
