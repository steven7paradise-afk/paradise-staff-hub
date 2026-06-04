type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

function sender() {
  return process.env.EMAIL_FROM ?? "Paradise Staff Hub <digital@paradisebeauty.it>";
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
  leaveRequestReceived: (employeeName: string, type: string, startDate: Date, endDate: Date, reason?: string | null) => {
    const start = startDate.toLocaleDateString("it-IT");
    const end = endDate.toLocaleDateString("it-IT");
    return {
      subject: `Nuova richiesta ${type.toLowerCase()} - ${employeeName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="background-color: #FFD6EA; color: #B85B68; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">Verifica Richiesta</span>
          </div>
          <h2 style="color: #1F1F1F; margin-top: 10px; margin-bottom: 4px; font-size: 20px; font-weight: 800; text-align: center; letter-spacing: -0.02em;">Nuova richiesta da verificare</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 16px; margin-bottom: 16px;">Il dipendente <strong>${employeeName}</strong> ha sottomesso una richiesta nel sistema:</p>
          
          <div style="background-color: #F7E9EF; border-radius: 16px; padding: 20px; border: 1px solid #FFD6EA; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1F1F1F;">
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #475569; width: 140px;">Tipo richiesta:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #B85B68; text-transform: uppercase;">${type}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #475569;">Periodo:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F;">dal ${start} al ${end}</td>
              </tr>
              ${reason ? `
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #475569; vertical-align: top;">Note dipendente:</td>
                <td style="padding: 6px 0; font-weight: 500; color: #475569; font-style: italic;">"${reason}"</td>
              </tr>` : ""}
            </table>
          </div>
          
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="https://staff.paradisebeauty.it/requests" style="display: inline-block; background-color: #1F1F1F; color: #ffffff; padding: 12px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(31, 31, 31, 0.15);">Gestisci Richiesta</a>
          </div>

          <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Puoi approvare, rifiutare o segnalare questa richiesta direttamente dalla tua console di amministrazione.
          </p>
        </div>
      `,
    };
  },
  leaveRequestDecision: (employeeName: string, status: string, type: string, startDate: Date, endDate: Date) => {
    const start = startDate.toLocaleDateString("it-IT");
    const end = endDate.toLocaleDateString("it-IT");
    const isApproved = status === "APPROVED";
    
    return {
      subject: `Richiesta ${isApproved ? "approvata" : "rifiutata"} - Paradise Staff Hub`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="background-color: ${isApproved ? "#d1fae5" : "#fee2e2"}; color: ${isApproved ? "#065f46" : "#991b1b"}; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">
              Richiesta ${isApproved ? "Approvata" : "Rifiutata"}
            </span>
          </div>
          <p style="font-size: 15px; color: #1F1F1F; line-height: 1.6; margin-top: 0; margin-bottom: 8px;">Ciao <strong>${employeeName}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px;">Ti informiamo che l'amministrazione ha completato la verifica della tua richiesta di assenza:</p>
          
          <div style="background-color: #f8fafc; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1F1F1F;">
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #64748b; width: 140px;">Tipo richiesta:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F; text-transform: uppercase;">${type}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Periodo:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F;">dal ${start} al ${end}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Puoi verificare il planning dei tuoi turni aggiornato accedendo alla tua console personale Paradise Staff Hub.
          </p>
        </div>
      `,
    };
  },
  payslipUploaded: (month: string) => ({
    subject: "Busta paga disponibile - Paradise Staff Hub",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="background-color: #FFD6EA; color: #B85B68; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">Documento HR</span>
        </div>
        <p style="font-size: 15px; color: #1F1F1F; line-height: 1.6; margin-top: 0; margin-bottom: 8px;">Ciao,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Ti informiamo che la tua busta paga relativa al mese di <strong>${month}</strong> è ora disponibile e scaricabile in formato PDF sul portale.</p>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="https://staff.paradisebeauty.it/documents" style="display: inline-block; background-color: #B85B68; color: #ffffff; padding: 12px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(184, 91, 104, 0.25);">Scarica Busta Paga</a>
        </div>
      </div>
    `,
  }),
  missingClock: (date: string) => ({
    subject: "Timbratura mancante - Paradise Staff Hub",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="background-color: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">Rilevazione Timbratura</span>
        </div>
        <p style="font-size: 15px; color: #1F1F1F; line-height: 1.6; margin-top: 0; margin-bottom: 8px;">Ciao,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Risulta una timbratura mancante (ingresso o uscita) per il giorno di lavoro <strong>${date}</strong>. Ti invitiamo ad accedere per verificare o richiedere una correzione manuale.</p>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="https://staff.paradisebeauty.it/my-shifts" style="display: inline-block; background-color: #1F1F1F; color: #ffffff; padding: 12px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none;">Verifica Turni</a>
        </div>
      </div>
    `,
  }),
  hoursSummary: (period: string, hours: string) => ({
    subject: "Riepilogo ore - Paradise Staff Hub",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="background-color: #FFD6EA; color: #B85B68; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">Riepilogo Ore</span>
        </div>
        <p style="font-size: 15px; color: #1F1F1F; line-height: 1.6; margin-top: 0; margin-bottom: 8px;">Ciao,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Il tuo riepilogo orario relativo al periodo <strong>${period}</strong> è stato compilato. Risultano registrate un totale di <strong>${hours} ore</strong>.</p>
      </div>
    `,
  }),
  accountCreated: (name: string, email: string, password: string, pin: string) => ({
    subject: "Accesso provvisorio Paradise Staff Hub",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
        <div style="text-align: center; margin-bottom: 28px;">
          <span style="background-color: #FFD6EA; color: #B85B68; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">Profilo Attivato</span>
          <h2 style="color: #1F1F1F; margin-top: 10px; margin-bottom: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Paradise Staff Hub</h2>
        </div>
        <p style="font-size: 15px; color: #1F1F1F; line-height: 1.6; margin-top: 0; margin-bottom: 8px;">Ciao <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Il tuo profilo per l'accesso a turni, buste paga e timbrature è pronto. Di seguito trovi le tue credenziali provvisorie per accedere:</p>
        
        <div style="background-color: #F7E9EF; border-radius: 16px; padding: 20px; border: 1px solid #FFD6EA; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1F1F1F;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569; width: 140px;">Email di accesso:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569;">Password temporanea:</td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 14px; font-weight: 700; color: #B85B68;">${password}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569;">PIN tablet salone:</td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 16px; font-weight: 800; color: #9E7A3B; tracking: 2px;">${pin}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="https://staff.paradisebeauty.it" style="display: inline-block; background-color: #1F1F1F; color: #ffffff; padding: 12px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(31, 31, 31, 0.15);">Accedi al Portale</a>
        </div>
        
        <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Ti consigliamo di modificare la password temporanea al primo accesso. Per ragioni di sicurezza, non condividere il tuo PIN personale con nessuno.
        </p>
      </div>
    `,
  }),
  formResponseSubmitted: (employeeName: string, formName: string, locationName: string) => ({
    subject: `Compilazione modulo: ${formName} - ${employeeName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 24px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.015);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="background-color: #FFD6EA; color: #B85B68; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; uppercase; tracking: 1px; letter-spacing: 0.1em;">Modulo Compilato</span>
        </div>
        <h2 style="color: #1F1F1F; margin-top: 10px; margin-bottom: 4px; font-size: 20px; font-weight: 800; text-align: center; letter-spacing: -0.02em;">Nuovo modulo ricevuto</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 16px; margin-bottom: 16px;">Il dipendente <strong>${employeeName}</strong> ha compilato ed inviato un modulo di servizio.</p>
        
        <div style="background-color: #F7E9EF; border-radius: 16px; padding: 20px; border: 1px solid #FFD6EA; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1F1F1F;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569; width: 140px;">Nome Modulo:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #B85B68;">${formName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569;">Sede/Salone:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #1F1F1F;">${locationName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #475569;">Data invio:</td>
              <td style="padding: 6px 0; font-weight: 500; color: #1F1F1F;">${new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="https://staff.paradisebeauty.it/settings/forms" style="display: inline-block; background-color: #1F1F1F; color: #ffffff; padding: 12px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(31, 31, 31, 0.15);">Visualizza Risposte</a>
        </div>
      </div>
    `,
  }),
};
