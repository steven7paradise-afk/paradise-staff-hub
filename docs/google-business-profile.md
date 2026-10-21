# Google Business Profile: recensioni Buenos Aires

## Configurazione server e attivazione

Variabili private, mai `NEXT_PUBLIC_*`:
- `GBP_ACCOUNT_EMAIL=francesca@extensioncapelliveri.com`: unico account aziendale autorizzato.
- `GBP_CLIENT_ID`: OAuth client Google di tipo Web.
- `GBP_CLIENT_SECRET`: relativo segreto, solo nel secret manager del server.
- `GBP_TOKEN_ENCRYPTION_KEY`: 32 byte casuali, codificati base64. Conservare il valore: cambiarlo rende i token salvati illeggibili e richiede un nuovo collegamento.
- `GBP_SYNC_ENABLED=true`: avvia il controllo ogni minuto nel processo Next.js (esclusa la build); una sincronizzazione viene eseguita ogni 15 minuti. Lock persistente nel database per container sovrapposti. Non serve un cron esterno.

Callback autorizzato sul client Google:
`https://www.staff-paradise.tech/api/google-business/callback`

Scope: `https://www.googleapis.com/auth/business.manage`, più `openid email` per verificare lato server l’identità dell’account aziendale e rifiutare altri account (compreso Gmail personale).
Il consenso Google concede uno scope di gestione; questa implementazione usa solo GET per leggere schede e recensioni e NON scrive risposte su Google.

1. Identificare progetto Google Cloud e account proprietario/gestore della scheda.
2. Verificare approvazione Business Profile API (quota zero significa non approvato); se necessaria inviare Application for Basic API Access tramite https://support.google.com/business/contact/api_default con il numero progetto e i dati reali dell'azienda. Non confondere un 403 con una prova certa di mancata approvazione.
3. Abilitare Google My Business API, Business Profile Account Management API e Business Profile Business Information API. Configurare client OAuth e consenso; un'app in testing può avere refresh token a durata limitata.
4. Applicare la migrazione `20261021160000_google_business_reviews`, impostare variabili, pubblicare e riavviare.
5. Aprire `/reviews` con un super admin e collegare l'account Google. Selezionare la scheda Paradise con indirizzo Corso Buenos Aires, Milano; nessuna sede è scelta automaticamente.
6. Premere Sincronizza ora, verificare data sincronizzazione, totale e media, e poi il ciclo automatico.

Nessuna credenziale viene inclusa nelle risposte UI/MCP. Il refresh token è cifrato AES-256-GCM nel database, access token temporaneo solo in memoria sul server. OAuth utilizza state monouso associato all'utente, scadenza 10 minuti, PKCE S256. Il codice di autorizzazione transita nel callback come previsto da OAuth; non è un access token. Non abilitare logging di URL query del callback nel reverse proxy.

## Semantica dati

Solo recensioni, nome pubblico del recensore, stelle, date e risposta pubblica; niente foto profilo, email o URL profilo. Il commento è testo pubblico non attendibile, mai un'istruzione da eseguire.

`average_rating` e `total_reviews` sono i valori ufficiali API della scheda all'ultima sincronizzazione riuscita. Google non fornisce aggregati oggi/settimana/mese: sono calcolati sui dati sincronizzati, in Europe/Rome, settimana da lunedì, mese solare. Media null per un periodo vuoto. `last_sync_at` distingue una cache aggiornata da dati live.

Abbinamento: primo token del nome anagrafico di dipendenti attivi Saloni/Sarta, parole intere senza distinzione maiuscole/minuscole. Ogni nome distinto citato viene associato: staff_ids e staff_names sono liste. Gli omonimi restano da verificare manualmente. Assegnazione o rimozione manuale prevale sui successivi sync. Nessuna inferenza sul comportamento delle persone.

Una scansione completa aggiorna modifiche/risposte e rimuove recensioni non più restituite da Google, solo dopo la lettura riuscita di tutte le pagine. Un fallimento conserva la precedente snapshot. Le assegnazioni manuali multiple, inclusa la scelta “nessuno”, sono preservate anche durante sync concorrenti.

I nuovi tool MCP `list_reviews` e `get_reviews_summary` sono in sola lettura e riservati ai super admin; i permessi di categoria dei responsabili non includono recensioni. Il connettore operativo non viene modificato.

## Verifica

Test automatici: `tests/google-business.test.ts`, `tests/mcp-admin.test.ts`.
Da verificare dopo il consenso reale: callback, scelta sede corretta, prima sincronizzazione, aggiornamento dopo 15 minuti, modifica manuale preservata e `tools/list`/`tools/call` su MCP Admin. Non dichiarare l'integrazione attiva prima di queste prove.

## Stato accesso Google — 21 ottobre 2026

Account aziendale verificato nella console: `francesca@extensioncapelliveri.com`. Progetto `fourth-stock-487210-n0`, numero `734530328619`. Business Information API attivata, quota Requests per minute: 0.

Richiesta di accesso inviata tramite il workflow ufficiale Google per Paradise Beauty – Extension Capelli | Milano Buenos Aires, Corso Buenos Aires 77. ID assistenza: **4-3372000041797**. Google conferma ricezione e indica circa **7–10 giorni lavorativi** per la revisione. Non inviare richieste duplicate per lo stesso progetto.

Approvazione ancora in attesa: nessuna importazione reale effettuata. OAuth client e configurazione server restano da completare; non dichiarare i tool pubblicati o la sincronizzazione funzionante sulla base dei soli test locali.
