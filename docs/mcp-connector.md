# Paradise Staff Hub: connettore MCP operativo

## Stato e attivazione

Implementazione da distribuire e collaudare con il connettore Claude reale. Non è una dashboard nuova: espone dati alla dashboard esterna e a Claude.

- Endpoint: `https://www.staff-paradise.tech/mcp`.
- SDK ufficiale TypeScript `@modelcontextprotocol/sdk`, Streamable HTTP stateless con risposte JSON. GET/SSE persistente e DELETE sessione rispondono 405 dopo autenticazione; ogni POST è indipendente.
- Discovery: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`.
- OAuth: `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`.
- Configurazione/revoca accessi: `/settings/mcp` (solo ZERO, SUPER_ADMIN, ADMIN attivi).

In Coolify, variabili runtime:

```dotenv
MCP_ENABLED=true
MCP_PUBLIC_ORIGIN=https://www.staff-paradise.tech
```

Non creare un token statico da incollare in Claude. Il login e il consenso generano credenziali OAuth per ogni connessione. `MCP_PUBLIC_ORIGIN` deve coincidere con l'origine HTTPS del login e del callback interno; non viene dedotto da header inviati dal client. `MCP_ENABLED` assente/false disabilita autorizzazione, emissione token e accesso MCP.

1. Distribuire questo codice con il lockfile aggiornato; `prisma generate` durante la build.
2. Applicare `prisma migrate deploy` (già eseguito da `scripts/start-production.sh`). La migrazione `20261019120000_mcp_oauth` aggiunge soltanto cinque tabelle MCP. Nessun cambiamento alle tabelle operative, nessuna migrazione applicata automaticamente durante i test locali.
3. Aprire `/settings/mcp` come amministratore. Selezionare persone, reparto, ruolo pubblico, capo reparto e capienza. Il default è **nessuna persona condivisa**, non una mappatura dedotta dai nomi o da informazioni HR.
4. Attivare le due variabili runtime, riavviare il container e verificare discovery/401.
5. In Claude: Impostazioni → Connettori → connettore personalizzato → URL `/mcp`. Completare il login esistente email/password o PIN, poi leggere e confermare il consenso. Nessun accesso viene accordato semplicemente perché esiste una sessione sul PC Cassa.
6. Provare `get_office_summary`, modificare un dato operativo lecito nello Staff Hub e richiamare il tool. Verificare l'aggiornamento, poi revocare l'accesso dalla pagina MCP e verificare 401.

Non pubblicare da un ramo che contenga altre modifiche non desiderate: la build distribuisce l'intera applicazione. La modifica Appuntamenti `6052ea1` preesiste a questo lavoro.

## Dati esposti e lacune esplicite

Sei tool: `get_office_summary`, `list_employees`, `get_employee`, `get_attendance`, `list_tasks`, `list_projects`.
Tutti hanno `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, outputSchema e risultati JSON duplicati in `structuredContent` e `content[0].text`. Gli errori MCP non contengono dettagli del DB.

I tool non scrivono dati operativi: effettuano solo SELECT. Le scritture tecniche OAuth, rotazione token e rate limit sono separate dalle tabelle utenti, task, presenze e documenti. I log di accesso sono strutturati su stdout (`service: staff-mcp`), senza token, argomenti o risultati.

- Reparti: chiavi esatte `ecom`, `mkt`, `admin`, `ceo`, `tit` nella configurazione DB `mcp_office_config_v1`.
- Capi reparto e capienze non esistevano: configurabili dall'interfaccia. `free_seats: null` indica capienza non configurata. I presenti e chi è in pausa occupano un posto; è una stima operativa, non un sensore di occupazione.
- `current_task`: task ACTIVE con `started_at` più recente fra quelle assegnate. Non indica con certezza quale attività la persona stia svolgendo fisicamente.
- Stati: IN → in_sede, BREAK → in_pausa, uscita registrata → fuori_sede, nessun evento → non_timbrato. Non si leggono richieste di ferie/malattia e non si deducono assenze o riunioni.
- Le ore sono ricavate dagli intervalli entrata/uscita, sottraendo pause, includendo la parte trascorsa dei turni ancora aperti. Ultimi sette giorni inclusa la data odierna. Eventuali timbrature mancanti richiedono correzione nello Staff Hub; non sono dati paga.
- Task: NEW/WAITING → da_fare; ACTIVE/COMPLETION_REQUESTED → in_corso; COMPLETED/DONE → completata. Le scadenze sono date locali; `due_before` è esclusivo. I conteggi e gli stati vengono letti dal DB a ogni chiamata.
- Privacy testi: **non si leggono i titoli e le descrizioni originali**, perché sono campi liberi che possono contenere informazioni private. Per default il titolo è “Attività operativa”, la descrizione null, `text_shared: false`. In `/settings/mcp` la direzione può fornire una versione operativa approvata del titolo/descrizione associata all'ID della task. Questi testi sono una versione condivisibile separata, mentre stato, assegnazioni, scadenza e conteggi restano live. L'approvatore deve escludere salute, retribuzioni, motivi d'assenza, contatti e altri dati personali.
- Non esiste una tabella/modulo progetti in questo checkout. `projects: []` e `data_notes` lo dichiarano. Non si trasformano arbitrariamente le task in progetti. Per popolare i progetti serve una fonte reale: un nuovo archivio oppure un adattatore al sistema che già li gestisce (id, titolo operativo, reparto, responsabile, assegnatari, task collegate, scadenza). Lo schema MCP è già dichiarato per questi campi.
- Esclusi dai SELECT: stipendi, IBAN, dati sanitari, motivi d'assenza, documenti, indirizzi, telefoni, codice fiscale, contatti email, allegati, commenti e note libere.

Ogni risposta include `generated_at` con offset Europe/Rome e `data_notes`. Le date locali e i confini giorno rispettano ora legale/solare.

## Aggiornamento della dashboard esterna

Nessuna copia statica o cache applicativa. Ogni tools/call legge il DB attuale; la risposta usa `Cache-Control: no-store`. Per la dashboard richiamare **get_office_summary ogni 15–30 secondi**, sospendendo quando non visibile e rispettando 429/Retry-After. Il trasporto Streamable HTTP non equivale a notifiche push dei dati aziendali: questa versione non mantiene una sottoscrizione live. Claude aggiorna i dati quando invoca il tool in chat; non aggiorna da solo una dashboard continuamente.

Conservare access/refresh token nel backend della dashboard, non nel codice pubblico o nel localStorage del browser. Il client OAuth backend usa HTTPS e PKCE; non serve CORS per chiamate server-server. Gli Origin web ammessi sono quelli dello Staff Hub e Claude; un frontend su un altro dominio richiede una decisione esplicita di allowlist, non `*` con credenziali.

## OAuth e sicurezza

- Scope unico `staff:read`, resource obbligatorio e identico a `/mcp` in authorize e token.
- DCR RFC7591 con redirect HTTPS esatti, senza fragment/credenziali; metodi none, client_secret_basic e client_secret_post. Niente wildcard redirect e nessun recupero remoto di metadati client/icone.
- Login Auth.js esistente; controllo ruolo/active riletto nel DB al consenso, token exchange, refresh e ogni richiesta MCP. Il ruolo RESPONSABILE non equivale a direzione.
- Consenso esplicito con nome client e callback effettivo. Protezione CSRF tramite nonce casuale, hash nel DB, cookie HttpOnly SameSite, controllo Origin e sessione. Ticket 10 minuti; authorization code 60 secondi e monouso atomico.
- PKCE S256 obbligatorio. Credenziali casuali 256 bit; solo hash SHA256 conservati.
- Access token 15 minuti; refresh token rotante con durata massima del grant 30 giorni. Riutilizzo di un refresh token revoca tutta la famiglia. Revoca supportata via RFC7009 e UI.
- Rate limit atomico PostgreSQL condiviso fra repliche: 60/minuto/token MCP, 60/minuto/client sul token endpoint, limiti globali DCR/token/revoca. Risposta 429 con Retry-After. Per il traffico anonimo applicare anche i limiti infrastrutturali del reverse proxy.
- Limiti body: 32 KiB per MCP e 16 KiB OAuth. Nessuna querystring access_token accettata. Origin sconosciuti rifiutati.
- Non memorizzare body OAuth, cookie, header Authorization o risposte MCP nei log del reverse proxy. Conservare i log operativi di accesso per il tempo stabilito dalla propria policy, con accesso riservato.

Manutenzione: eliminare periodicamente i rate bucket con `expires_at < NOW()`, i ticket OAuth scaduti e i grant scaduti da oltre 7 giorni (cascade sui token). Conservare i token ruotati almeno fino alla scadenza del grant per rilevare replay. Non cancellare token ancora utilizzabili. Client DCR mai utilizzati possono essere ripuliti con una policy dedicata senza rimuovere quelli associati a grant validi.

## Verifica

`node node_modules/tsx/dist/cli.mjs --test tests/mcp-*.test.ts`

`node node_modules/typescript/bin/tsc --noEmit --incremental false`

I test usano fixture e mock, nessun dato operativo reale viene modificato o inviato a Claude. Verificano PKCE, grant/code binding, rotazione/replay, scadenze/ruoli/audience/scope, limite distribuito, proiezione privacy, date Rome/DST e tutti i tool tramite il trasporto ufficiale SDK. Il collaudo OAuth browser → Claude reale e la migrazione sul server restano attività di attivazione, non sono attestati dai test unitari.

Riferimenti: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization e https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x .

## Correzione autorizzazione browser (19 ottobre 2026)

- Sessione assente: ritorno al login conservando l'intera query di autorizzazione. Sessione riferita a un utente non più presente: richiede un nuovo login.
- Account attivo senza ruolo amministratore: pagina HTML 403 con spiegazione, cambio account e ritorno al callback registrato con `error`, `error_description`, `state`. Non si promuovono automaticamente account.
- Errori dei parametri dopo la verifica del callback: redirect OAuth. Client sconosciuto o callback non registrato: errore HTML locale, mai redirect verso una destinazione non verificata.
- Consenso sul dominio canonico per evitare disallineamenti tra cookie e Origin del POST. Log con motivi distinti senza credenziali/query.
- Entrambi i callback Claude sono validi; devono essere registrati dal client e corrispondere esattamente alla richiesta. Supportati anche callback HTTP su IP loopback (`127.0.0.1`, `::1`) per Inspector; altri callback HTTP restano vietati.
- Prova reale Inspector CLI sulla versione locale: discovery, DCR, richiesta con PKCE, redirect al login con parametri preservati e pagina login 200. Il proprietario ha chiesto di non autorizzare: nessun consenso, token o lettura operativa reale collaudati.
- Account Brayan verificato attivo SUPER_ADMIN. Il motivo storico preciso del JSON `access_denied` non è dimostrato dai log consultati: nel vecchio GET proveniva solo dal controllo utente/ruolo; POST aveva ulteriori rifiuti indistinti (Origin, sessione, ticket/CSRF).
