const handler = async () => {
  const url = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) return new Response("Configurazione promemoria riposo mancante.", { status: 500 });

  const response = await fetch(`${url}/api/rest-reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  return new Response(await response.text(), { status: response.status });
};

export default handler;

// Le due ore UTC coprono le 15:00 italiane sia con ora solare sia con ora legale.
// Il controllo lato server accetta soltanto l'esecuzione che corrisponde alle 15:00 a Roma.
export const config = { schedule: "0 13,14 * * *" };
