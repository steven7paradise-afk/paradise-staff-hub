const handler = async () => {
  const url = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) return new Response("Configurazione promemoria contratti mancante.", { status: 500 });

  const response = await fetch(`${url}/api/contract-reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  return new Response(await response.text(), { status: response.status });
};

export default handler;

// Le due ore UTC coprono le 07:05 italiane sia con ora solare sia con ora legale.
export const config = { schedule: "5 5,6 * * *" };
