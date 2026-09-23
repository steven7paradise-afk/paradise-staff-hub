# Appuntamenti Mac: aggiornamento a eventi

Implementazione locale, da configurare e collaudare in produzione prima di distribuire l'app Mac.

## Percorso

Cowlendar → webhook firmato → transazione PostgreSQL (deduplica, invalidazione cache,
revisione e NOTIFY) → SSE autenticato → aggiornamento dell'agenda Mac.
Anche le modifiche locali di stato e collaboratrice pubblicano una revisione.
Il Mac non interroga più l'agenda ogni 30 secondi. Carica all'apertura, su azione
dell'utente e quando riceve una revisione non ancora applicata. Le riconnessioni
recuperano l'ultima revisione; i keepalive non caricano appuntamenti.
L'aggiornamento non sostituisce il modello del modulo/dettaglio aperto.

## Configurazione server

- `APPOINTMENTS_REALTIME_ENABLED=true`
- `APPOINTMENTS_REALTIME_DATABASE_URL`: connessione PostgreSQL diretta o session-pooled,
  allo **stesso database** usato da Prisma. Non usare transaction pooling. Conservare
  SSL e verifica certificati richiesti dal provider; non disabilitarli.
- `COWLENDAR_WEBHOOK_SHOP_DOMAIN`: dominio myshopify.com esatto indicato dal payload.
- `COWLENDAR_WEBHOOK_SECRET`: signing secret del nuovo endpoint, inserito nel gestore
  segreti del server. Non inserirlo nel Mac, nel repository o nei messaggi.

Non sono necessarie migrazioni: revisione e soli ID evento sono salvati in Setting.
Gli ID deduplicati sono conservati senza scadenza; pianificare una policy di retention
prima di un volume elevato, più lunga dell'intero intervallo di retry Cowlendar.
Una connessione PostgreSQL per Mac aperto: dimensionare limite connessioni e pool
Prisma. Il proxy deve consentire streaming senza buffering/cache e almeno 300 s.
Lo stream si rinnova ogni 240 s e ricontrolla l'autorizzazione PC ogni 20 s.

## Attivazione (ordine importante)

1. Pubblicare il backend con le nuove route, mantenendo la funzione disabilitata.
2. Creare **un nuovo** endpoint Cowlendar, senza modificare quelli Make esistenti.
   Nome suggerito: `Paradise Mac - Appuntamenti live`.
   URL previsto dopo pubblicazione:
   `https://www.staff-paradise.tech/api/webhooks/cowlendar`.
   Selezionare booking.created, booking.confirmed, booking.declined, booking.canceled,
   booking.rescheduled, booking.attendance_changed.
3. Salvare subito il signing secret mostrato una sola volta nella configurazione
   server, aggiungere dominio negozio e URL database e abilitare la funzione.
   Prima di questo passaggio il webhook risponde intenzionalmente 503.
4. Usare Test (`webhook.ping`): deve rispondere 200 senza cambiare l'agenda.
5. Con un Mac autorizzato verificare lo stream (200 text/event-stream, eventi
   immediati, keepalive). Client non autorizzato: 401 quando funzione abilitata.
6. In ambiente di prova creare/spostare/cancellare una prenotazione e verificare
   aggiornamento senza refresh, stessa data/ricerca/scroll e nessuna perdita di bozze.
   Non creare prenotazioni reali senza consenso: possono inviare email.
7. Testare due repliche backend, due Mac, replay duplicato, disconnessione/ripresa,
   revoca dispositivo, cambio data durante il caricamento e errore API Cowlendar.
8. Solo dopo il collaudo preparare/distribuire il nuovo DMG. Le vecchie app non
   acquistano automaticamente questa funzione con il solo deploy del server.

Il canale copre eventi di prenotazione e stato/assegnazione locale, non tutte le
modifiche di note Shopify o presenze personale: per quelle resta Aggiorna manuale.
Se il server non è configurato, questa versione Mac mantiene caricamento iniziale
e manuale e ritenta la connessione con backoff, senza polling degli appuntamenti.

## Verifica locale

`npx tsx --test tests/cowlendar-webhook*.test.ts`
`npm run typecheck`
Nel progetto ParadiseAppointmentsMac: `swift build`.
Questi controlli non sostituiscono il collaudo end-to-end con database/proxy/Cowlendar.

Protocollo firma (HMAC SHA256 su timestamp + punto + body originale, finestra 5 min):
https://help.cowlendar.com/how-to-integrations/connect-cowlendar-to-crm-erp-or-app-public-api-webhooks
