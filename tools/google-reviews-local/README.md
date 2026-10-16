# Recensioni Paradise — ambiente locale
Avvio con Node 22 o successivo:

    node tools/google-reviews-local/server.mjs

Aprire http://localhost:4317. Il server ascolta soltanto 127.0.0.1; nessun accesso al database di produzione. I dati sono in `.local-data/reviews.json`, esclusi da Git. Conservare una copia di questa cartella per il backup. Non eseguire più processi sulla stessa cartella. È un banco di lavoro locale della direzione, senza autenticazione multiutente: non pubblicare su Internet.

Funzioni: mese di pubblicazione (Europe/Rome), elenco e ricerca, riconoscimento nomi come suggerimenti, verifica manuale, esclusione, premio positivo 5 € per persona, importazione JSON e API, deduplicazione per reviewId, invalidazione della conferma quando una recensione cambia. Nessun PDF, pagamento o modifica ai premi del gestionale.

## Importazione Google Business
La sessione Google del browser non è utilizzata. Occorrono l'accesso approvato alle API Business Profile, un OAuth client autorizzato dal gestore della sede con scope `https://www.googleapis.com/auth/business.manage` e la sede verificata. L'applicazione usa soltanto letture di recensioni, senza risposte o modifiche su Google.

Configurare in un file `.env.local` locale (ignorato da Git), quindi avviare con `node --env-file=percorso/.env.local tools/google-reviews-local/server.mjs`:

    GBP_CLIENT_ID=...
    GBP_CLIENT_SECRET=...
    GBP_REFRESH_TOKEN=...
    GBP_LOCATION=accounts/ACCOUNT_ID/locations/LOCATION_ID

In alternativa è supportato GBP_ACCESS_TOKEN (temporaneo) con GBP_LOCATION. Non usare come locationId il numero presente nel link della ricerca: recuperare gli ID dalle API Business Profile e verificare che la sede sia Corso Buenos Aires 77. Il collegamento OAuth interattivo e la scelta della sede non sono ancora implementati: configurazione manuale sul server.

“Importa da Google” percorre tutte le pagine da 50 recensioni, senza arrestarsi sulle date di aggiornamento. Il filtro del mese usa createTime, non updateTime né la risposta del proprietario. Nessun salvataggio parziale se Google fallisce. Importazione su richiesta, non schedulata; le recensioni eliminate su Google non vengono rimosse automaticamente dall'archivio locale.

Docs: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list

## File JSON
Accetta array oppure `{ "reviews": [...] }` con i campi API Google (reviewId, reviewer.displayName, starRating, createTime, comment) oppure:

    [{"id":"ID-STABILE","author":"Cliente","date":"2026-09-20","rating":5,"comment":"Testo completo","url":"https://maps.app.goo.gl/..."}]

Importare soltanto recensioni della sede Buenos Aires. I file sono marcati come non verificati. Mantenere ID stabili per rilevare modifiche; in assenza di ID si usa autore+data+testo, che non riconosce una modifica del testo come la stessa recensione. I campi status/assigned/positive nei file non sono accettati come decisioni già verificate. Non sono inclusi dati del vecchio PDF né recensioni inventate.

Test: `node --test tools/google-reviews-local/model.test.mjs`.
