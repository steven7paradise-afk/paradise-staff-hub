type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

function sender() {
  return process.env.EMAIL_FROM ?? "Paradise Staff Hub <no-reply@paradisebeauty.local>";
}

export async function sendEmail({ to, subject, html }: MailPayload) {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.EMAIL_API_KEY;

  if (!provider || !apiKey) {
    return { skipped: true, reason: "Email environment not configured" };
  }

  if (provider.toLowerCase() === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: sender(), to, subject, html }),
    });

    if (!response.ok) {
      throw new Error(`Resend email failed: ${response.status}`);
    }
    return { skipped: false };
  }

  if (provider.toLowerCase() === "brevo") {
    const email = sender().match(/<(.+)>/)?.[1] ?? sender();
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo email failed: ${response.status}`);
    }
    return { skipped: false };
  }

  return { skipped: true, reason: `Unsupported provider: ${provider}` };
}

export const emailTemplates = {
  leaveRequestReceived: (employeeName: string) => ({
    subject: "Richiesta ferie/permesso ricevuta",
    html: `<p>La richiesta di ${employeeName} e stata ricevuta ed e in attesa di approvazione.</p>`,
  }),
  leaveRequestDecision: (status: string) => ({
    subject: `Richiesta ${status.toLowerCase()}`,
    html: `<p>La tua richiesta e stata ${status.toLowerCase()}.</p>`,
  }),
  payslipUploaded: (month: string) => ({
    subject: "Busta paga disponibile",
    html: `<p>La busta paga di ${month} e disponibile in Paradise Staff Hub.</p>`,
  }),
  missingClock: (date: string) => ({
    subject: "Timbratura mancante",
    html: `<p>Risulta una timbratura mancante per il giorno ${date}.</p>`,
  }),
  hoursSummary: (period: string, hours: string) => ({
    subject: "Riepilogo ore",
    html: `<p>Riepilogo ${period}: ${hours} ore registrate.</p>`,
  }),
  accountCreated: (name: string, email: string, password: string, pin: string) => ({
    subject: "Accesso provvisorio Paradise Staff Hub",
    html: `
      <p>Ciao ${name},</p>
      <p>il tuo profilo Paradise Staff Hub e stato creato.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password provvisoria:</strong> ${password}</p>
      <p><strong>PIN timbratura:</strong> ${pin}</p>
      <p>Ti consigliamo di cambiare la password al primo accesso quando disponibile.</p>
    `,
  }),
};
