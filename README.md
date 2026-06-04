# Paradise Staff Hub

Web app HR interna per Paradise Beauty con Next.js, TypeScript, Tailwind CSS, Prisma, PostgreSQL Neon, Netlify, Google Sheets ed email provider configurabile.

## Funzioni incluse

- Dashboard HR responsive per desktop, tablet e mobile
- Ruoli: Super Admin, Admin, Responsabile, Dipendente
- Middleware permessi per proteggere le pagine
- Gestione dipendenti, timbrature, richieste ferie/permessi, documenti, notifiche
- Planning mensile admin con categorie turno colorate e stampa PDF
- Approvazione ferie/permessi/riposi sincronizzata automaticamente nel planning mensile
- Modalita tablet per timbratura con controllo `device_id`
- Prisma schema completo per Neon PostgreSQL
- Sync timbrature verso Google Sheet
- Moduli email per ferie, approvazioni, buste paga, mancate timbrature e riepiloghi ore
- Configurazione Netlify con `@netlify/plugin-nextjs`
- Branding iniziale luxury beauty configurabile

## Installazione

```bash
cd paradise-staff-hub
npm install
cp .env.example .env
npm run prisma:generate
```

Poi compila le variabili in `.env`.

```env
DATABASE_URL=
NEXTAUTH_SECRET=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_FROM=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
NEXT_PUBLIC_APP_URL=https://paradise-staff-hub.netlify.app
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROFILE_BUCKET=profile-images
SUPABASE_DOCUMENTS_BUCKET=staff-documents
NEXT_PUBLIC_DEMO_MODE=
```

## Configurazione Neon

1. Crea un progetto PostgreSQL su Neon.
2. Copia la connection string pooled o direct in `DATABASE_URL`.
3. Esegui:

```bash
npm run prisma:migrate
npm run db:seed
```

Per produzione/Netlify usa le migrazioni versionate:

```bash
npm run db:deploy
```

Seed iniziale:

- email: `admin@paradisebeauty.it`
- password: `ChangeMe123!`
- PIN: `1234`

Cambia subito password e PIN in produzione.

## Configurazione Netlify

Il progetto include `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Su Netlify imposta le variabili ambiente nella dashboard del sito, non nel codice. Poi:

```bash
npm run build
npx netlify deploy
npx netlify deploy --prod
```

## Configurazione Google Sheet

Non salvare mai il JSON completo del service account nel repository. Se una private key viene incollata in chat, issue, commit o log condivisi, revocala subito da Google Cloud e generane una nuova.

1. Crea un Google Sheet con tab, per esempio `Timbrature`.
2. Crea un service account Google Cloud con accesso Sheets API.
3. Condividi il foglio con `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Imposta:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
```

Ogni timbratura aggiunge una riga con: Data, Ora, Dipendente, Email, Sede, Tipo timbratura, Dispositivo, Note.

## Configurazione email

Provider supportati dal modulo iniziale:

- `resend`: `EMAIL_API_KEY` e `EMAIL_FROM`
- `brevo`: `EMAIL_API_KEY` e `EMAIL_FROM`

Variabili:

```env
EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM="Paradise Beauty HR <hr@paradisebeauty.it>"
```

## Configurazione WhatsApp

Le notifiche interne possono inviare anche un messaggio WhatsApp al numero impostato sul profilo del dipendente.

1. Crea una app Meta con WhatsApp Cloud API.
2. Copia il `Phone Number ID` e genera un access token.
3. Su Netlify imposta:

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
NEXT_PUBLIC_APP_URL=https://paradise-staff-hub.netlify.app
```

Nel profilo dipendente inserisci il numero in formato internazionale, per esempio `+393331234567`.

## Configurazione Supabase Storage

Gli upload del profilo e dei documenti passano solo dal server. Non inserire mai la service role key nel frontend.

1. Crea un progetto Supabase e due bucket Storage: `profile-images` pubblico e `staff-documents` privato.
2. Su Netlify imposta:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROFILE_BUCKET=profile-images
SUPABASE_DOCUMENTS_BUCKET=staff-documents
```

3. Applica la migrazione Prisma per il campo di archiviazione dei documenti:

```bash
npx prisma migrate deploy
```

Le foto profilo usano il bucket pubblico. Per buste paga e contratti il database salva il percorso privato e l'app genera un link temporaneo soltanto dopo il controllo accesso.

## Sviluppo

```bash
npm run dev
```

Apri `http://localhost:3000`.

## Planning mensile e PDF

La pagina `/schedules` permette ad Admin, Super Admin e Responsabili di:

- scegliere mese e anno
- assegnare categorie/orari cliccando sulle celle
- creare nuove categorie con colore, codice e fascia oraria
- stampare o salvare in PDF in formato A4 orizzontale

I modelli Prisma `schedule_categories` e `schedule_entries` sono pronti per salvare categorie e turni mensili su Neon.

Quando un Admin o Super Admin approva una richiesta con:

```http
PATCH /api/requests/{id}
Content-Type: application/json

{ "status": "APPROVED" }
```

il sistema aggiorna la richiesta e crea automaticamente una cella nel planning per ogni giorno del periodo richiesto. La categoria viene mappata cosi: `FERIE` -> `F`, `PERMESSO` -> `PE`, `RIPOSO` -> `R`, `MALATTIA` -> `ML`.

## Produzione

Prima del deploy:

```bash
npm run build
```

Controlla che tutte le variabili ambiente siano presenti su Netlify e che il database Neon accetti connessioni dal runtime serverless.

Per un preview rapido dell'interfaccia senza login/database puoi impostare temporaneamente:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Disattivalo prima dell'uso reale in produzione.
