# In corso — Mac e mobile

Implementazione locale, non ancora distribuita. Nessuna migrazione: richieste persistite come record individuali `salon_live:<locationId>:<uuid>` in Setting. I campi di autore, cliente, sede, prezzo e variante sono determinati dal server.

## Flusso

- Mobile personale → Le mie clienti → Controllo cliente → Cassa: caffè, acqua, assistenza, nota, codice prodotto da fotocamera o manuale e quantità.
- Accesso consentito soltanto per assegnazione ID locale/alias esplicito; invio solo per cliente arrivata/in lavorazione. Le sedi riconoscibili dal servizio sono risolte sul server, altrimenti si usa la sede della lavoratrice.
- Mac autorizzato → In corso: clienti in lavorazione, richieste, riepilogo carrello, ingressi odierni della sede. Eventi SSE esistenti aggiornano la dashboard; il banner è interno all’app Mac, non una notifica push Apple.
- Prendi in carico → Completa/Annulla. Solo il medesimo operatore può chiudere la richiesta. Concorrenza protetta dal confronto atomico del record precedente; richieste inviate con UUID sono idempotenti.
- Prodotti letti dal catalogo Shopify, con barcode esatto e univoco, prezzo e valuta. Il riepilogo è un **carrello preparatorio interno**, NON un Draft Order Shopify; non incassa, non riserva stock e non modifica l’ordine. La cassa finalizza in Shopify, poi registra il numero verificato. Il server controlla che l’ordine esista; la corrispondenza della cliente va verificata dalla cassiera.
- Le note sono collegate internamente alla cliente/ordine, non copiate automaticamente nelle note Shopify.

## Prima della pubblicazione

1. Verificare credenziale Shopify con accesso lettura prodotti (`read_products`) e ordini. Query documentata: https://shopify.dev/docs/api/admin-graphql/latest/queries/productVariants (versione fissata 2026-07).
2. `APPOINTMENTS_REALTIME_ENABLED=true` e connessione diretta/session pooled `APPOINTMENTS_REALTIME_DATABASE_URL` per SSE. Senza configurazione realtime resta solo aggiornamento manuale.
3. Pubblicare backend prima di distribuire build Mac/iOS. Le app attualmente installate non contengono queste modifiche.
4. Eseguire prova reale con due lavoratrici e due PC/sedi: assegnazione negata, richiesta stessa sede, presa in carico concorrente, prodotto inesistente/ambiguo, ripetizione UUID, nota/ordine, timbratura e riconnessione SSE.
5. Prova fotocamera su iPhone fisico (non verificabile con build simulatore). Permesso negato: inserimento manuale disponibile.

## Limiti dichiarati

Nuove richieste richiedono Internet. In caso di errore il modulo mantiene i valori e l’UUID del tentativo finché la schermata resta aperta; non è una coda offline persistente. Push all’iPhone ancora fuori da questa fase. Gli ingressi producono eventi dal percorso reale `/api/attendance/clock`, non dagli inserimenti manuali retroattivi.

Verifiche locali: typecheck Next, test policy di assegnazione/input/transizioni, suite Swift Mac e build iOS simulatore. Test end-to-end sul server e dispositivi ancora necessari.
