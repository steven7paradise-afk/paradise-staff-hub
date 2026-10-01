# Pagamenti Shopify nella scheda cliente

## Attivazione richiesta

Il codice da solo non registra una sottoscrizione Shopify.
Pubblicare il backend, poi configurare nel gestore segreti server:

- `SHOPIFY_PAYMENTS_WEBHOOK_SECRET`: segreto di firma della sottoscrizione Shopify (non il token Admin API, non il segreto Cowlendar).
- `SHOPIFY_SHOP_DOMAIN`: dominio esatto `*.myshopify.com`.
- `APPOINTMENTS_REALTIME_ENABLED=true` e `APPOINTMENTS_REALTIME_DATABASE_URL`: stessa connessione diretta/session-pooled descritta in appointments-realtime.md.

Registrare **una nuova** sottoscrizione `orders/paid` con destinazione
`https://www.staff-paradise.tech/api/webhooks/shopify/payments`.
Non sostituire le sottoscrizioni Cowlendar/Make esistenti. Non creare pagamenti reali per il collaudo.

## Garanzie e limiti

HMAC sul body originale, controllo negozio, limite 1 MB, deduplica persistente e revisione/NOTIFY nella stessa transazione. Errori DB rispondono 503 per consentire retry. Sono memorizzati soltanto ID consegna e data, senza dati cliente; definire retention a volume elevato.

Lo stream autenticato invia solo revisioni. La scheda aperta rilegge Shopify senza cache, conservando la bozza. Riconnessione e ritorno alla scheda innescano una rilettura; rimane il controllo ogni 30 secondi. Non è una garanzia di latenza Shopify.

La rilettura parte subito alla ricezione dell'evento, senza attendere il controllo periodico. Dopo la verifica della cliente appare l'elenco di tutti i pagamenti del giorno con ordine, nome, data e importo, agganciato in alto durante lo scorrimento. Il pulsante `+` di ogni pagamento seleziona quell'ordine come saldo e destinazione della nota usando il salvataggio automatico della scheda; diventa una spunta con testo Selezionato. Il rilevamento da solo non sostituisce la selezione. `Storico ordini` apre lo storico in una finestra. Il cambio cliente rimuove l'elenco precedente. La dicitura Punto vendita viene mostrata solo con `source_name=pos`.

Elenco del giorno: tutti gli ordini pagati creati nel giorno dell'appuntamento (Europe/Rome), inclusi gli acconti, deduplicati e ordinati dal più recente. L'identità viene verificata tramite il customer ID Shopify dell'ordine originale della prenotazione, quando presente tra gli ordini recuperati; in assenza di tale riferimento servono contatti esatti senza conflitti. Soli nomi o email simili non bastano. Non viene sovrascritto un saldo già selezionato senza il clic esplicito. Ordini creati in giorni precedenti e pagati oggi restano nello storico per scelta manuale.

## Collaudo prima di dichiararlo attivo

Alla conferma dalla scheda appuntamento, senza selezione esplicita, il server verifica la prenotazione e rilegge tutti gli ordini pagati della cliente nel giorno dell'appuntamento. La stessa nota e i campi di controllo vengono scritti su ciascun ordine. La bozza non invia note. Una selezione con `+` limita la destinazione a quell'ordine; `Usa tutti i pagamenti del giorno` ripristina la modalità giornaliera. Il server non usa la lista del browser come elenco fidato delle destinazioni. Se la verifica fallisce non conferma; se un invio fallisce mostra gli ordini interessati e mantiene aperta la scheda per riprovare. Senza pagamenti verificati non ripiega silenziosamente sull'acconto di un altro giorno.

`npx tsx --test tests/client-control-note-sync.test.ts tests/appointment-payment-match.test.ts`

`npx tsx --test tests/shopify-payment-webhook.test.ts tests/appointment-payment-match.test.ts tests/cowlendar-webhook*.test.ts`

Verificare in staging con Shopify: consegna firmata 200, doppia consegna senza doppia revisione, scheda della cliente corretta aggiornata, altra cliente non selezionata, contatti ambigui senza associazione, saldo manuale preservato, disconnessione/riconnessione. Verificare browser autenticato e PC autorizzato. Il test automatico usa DB simulato e non prova configurazione Shopify/proxy reali.
