# Chat interna — prima implementazione

Sviluppo isolato sul ramo `codex/internal-chat`. Non distribuito in produzione e non incluso nella build 1.3 (5) preparata per Apple.

## Funzioni implementate

- Accesso con la sessione mobile MyParadise esistente; nessuna registrazione pubblica.
- Rubrica limitata a nome, foto e sede dei lavoratori attivi.
- Conversazioni private a due persone, gruppi e canali riservati con partecipanti espliciti.
- Creazione canali per ADMIN, SUPER_ADMIN, ZERO e RESPONSABILE. Nessun ruolo può leggere automaticamente le conversazioni di cui non è membro.
- Persistenza PostgreSQL, ricerca delle conversazioni per titolo, cronologia paginata, non letti e segnatura di lettura.
- Invio idempotente, massimo 4000 caratteri e 30 nuovi messaggi al minuto per utente.
- Modifica/eliminazione del proprio messaggio; archiviazione dei gruppi/canali da parte del creatore.
- Blocco di utenti sospesi, ex dipendenti, sessioni scadute/revocate e account che devono cambiare password.
- Allegati privati PDF, JPEG, PNG e TXT fino a 5 MB; anteprima nativa Quick Look, limite di 100 MB/giorno per autore, controllo accessi su ogni download e cancellazione dei byte quando si elimina il messaggio.
- Predisposizione push APNs: registrazione autenticata del dispositivo, messaggio generico senza contenuto privato, preferenza silenzia per conversazione, esclusione di mittente/account sospesi/sessioni revocate.
- Interfaccia nativa italiana, tema e accento esistenti. Accesso da Avvisi → Chat del team.
- Aggiornamento mediante richieste ogni 3 secondi nella conversazione e 5 secondi nell’elenco, solo in primo piano. Non è ancora un trasporto realtime WebSocket.

## Da completare prima del rilascio della funzione completa

Menzioni strutturate, prova delle notifiche push su dispositivi reali, thread/reazioni/messaggi fissati, ricerca nel testo, gestione dei partecipanti dopo la creazione, registro delle operazioni, conservazione e cancellazione amministrativa, vista web desktop. La registrazione push risponde esplicitamente 503 quando il servizio non è configurato. L’invio è best effort dopo il salvataggio: manca ancora una coda durevole con tentativi automatici, e non si può garantire consegna immediata. Il tap della notifica apre l’app attraverso la normale autenticazione; la conversazione si apre poi da Avvisi. Il pulsante di registrazione va ripetuto se cambia account/dispositivo; il rinnovo automatico del token va completato prima del rilascio.

Audio/video, stanze vocali, condivisione schermo e riunioni appartengono alla fase successiva. Nessun servizio è stato acquistato. I permessi di accesso non costituiscono cifratura end-to-end.

## Attivazione in un ambiente di test

1. Usare un database PostgreSQL di test, senza dati o credenziali di produzione.
2. Installare le dipendenze del progetto e generare Prisma (`pnpm exec prisma generate`).
3. Applicare le migrazioni (`pnpm exec prisma migrate deploy`). La nuova migrazione aggiunge solo chat_rooms, chat_members, chat_messages e chat_attachments e i loro vincoli; non modifica i record staff.
4. Impostare `DATABASE_URL`, `AUTH_SECRET` e `INTERNAL_CHAT_ENABLED=true`. Senza il flag l’API risponde 503, con messaggio esplicito.
5. Per la prova push, aggiungere `CHAT_PUSH_ENABLED=true`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` nei segreti del server di test. Non copiare chiavi nel repository. Topic: `it.paradisebeauty.myparadise`; Debug usa sandbox, Release produzione. Il widget ha un topic separato. Nessun nuovo acquisto effettuato.
6. Avviare Next e usare la copia dell’app in `../MyParadise-chat`, con il server di test configurato.

Non applicare questa migrazione a Neon di produzione finché le funzioni mancanti e la prova su due dispositivi fisici non sono state completate. Le istruzioni non eseguono un deploy.

## Verifiche

- Compilazione iOS per simulatore.
- Typecheck TypeScript.
- Test di integrazione del vero route handler con tre account in PostgreSQL locale: chat privata, canale privato, amministratore estraneo, deduplicazione, lettura, modifica/eliminazione, archiviazione, account sospeso/ex dipendente e rilettura dei dati dopo riconnessione; download allegati consentito/negato, deduplicazione, limite dimensioni, eliminazione allegato, rifiuto push non configurato.
- Scambio HTTP tra due account, invio dalla UI del simulatore e ricezione automatica della risposta.

Per eseguire `tests/internal-chat.integration.ts`, usare **solo un database locale usa-e-getta sulla porta 55439**, con schema già applicato:

```sh
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true' INTERNAL_CHAT_ENABLED=true pnpm exec tsx tests/internal-chat.integration.ts
```

Il test rifiuta qualsiasi altro host/porta e crea solo account `example.invalid`. Non verifica ancora carico elevato, due telefoni fisici, push, riavvio del processo database o consegna APNs. L’anteprima Quick Look e il selettore file compilano ma restano da verificare manualmente su telefono.

`tests/chat-preview-seed.ts` prepara esclusivamente dati locali chiaramente marcati di prova e una sessione breve. La modalità `--preview-chat` è compilata solo in DEBUG per simulatore, punta solo a 127.0.0.1:3108 e non viene inclusa nelle build di distribuzione.

## Esito locale del 8 ottobre 2026

Build simulatore riuscita e typecheck TypeScript passato. Test integrazione passato. Richiesta upload al server Next di test: HTTP 200; il simulatore mostra il nome dell’allegato e il nuovo non letto. Le prove usano dati fittizi su database locale PGlite, non Neon. Log nel workspace padre: `chat-ios-build.log`, `chat-typecheck.log`, `chat-integration.log`.
