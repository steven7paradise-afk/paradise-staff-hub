export default async () => {
  const url = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) {
    return new Response("Configurazione chiusura turni mancante.", { status: 500 });
  }

  const response = await fetch(`${url}/api/attendance/close-open-shifts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  return new Response(await response.text(), { status: response.status });
};

// Le esecuzioni UTC coprono le 22:05 italiane sia con ora solare sia con ora legale.
export const config = { schedule: "5 20,21 * * *" };
