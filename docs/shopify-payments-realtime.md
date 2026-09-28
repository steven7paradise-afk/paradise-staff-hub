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

Selezione automatica: email o telefono esatti, nessun contatto in conflitto, un solo ordine pagato creato nel giorno dell'appuntamento (Europe/Rome), escluso l'acconto. Più candidati, soli nomi, email simili o numeri incompleti richiedono verifica manuale. Non viene sovrascritto un saldo già selezionato. Ordini creati in giorni precedenti e pagati oggi restano nello storico per scelta manuale.

## Collaudo prima di dichiararlo attivo

`npx tsx --test tests/shopify-payment-webhook.test.ts tests/appointment-payment-match.test.ts tests/cowlendar-webhook*.test.ts`

Verificare in staging con Shopify: consegna firmata 200, doppia consegna senza doppia revisione, scheda della cliente corretta aggiornata, altra cliente non selezionata, contatti ambigui senza associazione, saldo manuale preservato, disconnessione/riconnessione. Verificare browser autenticato e PC autorizzato. Il test automatico usa DB simulato e non prova configurazione Shopify/proxy reali.
