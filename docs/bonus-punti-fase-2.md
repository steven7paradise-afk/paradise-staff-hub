# Bonus a punti — Fase 2

Specifica ricevuta il 28 settembre 2026. Decisione confermata dall’utente:
**dal 28 settembre 2026 il nuovo conto deve sostituire il Centro Punti** (decorrenza anticipata su richiesta successiva). Non è un
secondo portafoglio. Decorrenza nel fuso Europe/Rome.

## Regole concordate

Un punto vale 5 €. Master: base 50, tetto 100; Autonoma: base 30, tetto 60;
Junior: base 20, tetto 40. Il saldo è `max(0, min(tetto, base + bonus - malus))`.
Il mese successivo parte dalla base del livello assegnato, senza residui o debiti.
La puntualità non assegna punti. Nessun punto presenza o malus malattia previsto.

| Evento | Regola |
| --- | --- |
| Ritardo mattina | primi 3 nel mese tollerati; dal 4° −10 ciascuno |
| Ritardo rientro pausa | primi 3 tollerati; dal 4° −2 ciascuno |
| Lettera di contestazione | −20 |
| Richiamo presentabilità | primi 2 tollerati; dal 3° −10 ciascuno |
| Rilavorazioni | prime 3 gratuite; −20 per blocchi successivi di 3, modalità da confermare |
| Recensione negativa nominativa | −2 |
| Appuntamento extra | +0,5, solo Master/Autonome; quota mensile impostata da Steven in Gestione punti |
| Cambio turno ultimo momento | +1 |
| Recensione positiva nominativa | prime 20 senza bonus; dalla 21ª +1 ciascuna |
| Reperibilità urgenza confermata | +1 |
| Zero rilavorazioni nel mese | +3 Junior, verificabile soltanto a mese concluso |
| Formazione | +2 Junior per corso |

Le recensioni devono nominare la persona. Le recensioni generiche appartengono
al team/reception e non entrano nel saldo individuale.

RS: malus e bonus ordinari per le persone assegnate. Master di riferimento:
solo i due bonus Junior. Direzione (ZERO/SUPER_ADMIN/ADMIN): consultazione;
nessuna modifica diretta degli eventi. Registrare anche gli eventi in franchigia.

## Stato effettivo del lavoro

Preparato `lib/monthly-bonus.ts`, motore puro con test dedicati:
calcolo, franchigie, permessi espliciti, storico per aggiunta, duplicati,
decorrenza e reset mensile. Nessuna scrittura su Neon, nessuna attribuzione a
persone reali, nessuna sostituzione delle pagine esistenti ancora attivata.

## Risposte ancora necessarie

1. Blocchi rilavorazioni: −20 a blocco completato (6ª, 9ª, 12ª), oppure a
   blocco iniziato (4ª, 7ª, 10ª)? Il motore supporta entrambe, senza default.
2. Elenco reale dei livelli, RS per persona/sede e Master di riferimento Junior.
   Le persone nella specifica sono esempi, non assegnazioni autorizzate.

## Integrazione ancora da completare

- Dashboard personale, registro eventi con anteprima e riepilogo direzione.
- Persistenza mensile append-only con livello e regola congelati per il mese.
  Il preview è informativo: ricontare sotto lock in transazione prima dell’append.
  Deduplicare per identificativo stabile della fonte o chiave di idempotenza.
- Registrazioni tardive: gli eventi preesistenti conservano i punti registrati;
  l’ordinale indica l’ordine di registrazione nel mese, distinto dalla data evento.
  Correzioni da concordare, con nuova registrazione visibile, mai sovrascrittura.
- Ritardi: collegare le timbrature PIN e le regole effettive del salone. Il vecchio
  report usa oltre 10 minuti per l’ingresso, mentre `scheduled-attendance.ts`
  usa una tolleranza di 3 minuti: risolvere la differenza prima di applicare malus.
- Appuntamenti: verificare un identificativo univoco e lo stato effettivamente
  completato. Una scheda Controllo Cliente non è automaticamente un appuntamento.
  Usare la quota mensile impostata da Steven in Gestione punti, evitare doppioni app/Shopify
  ed evitare accrediti per appuntamenti annullati o no-show.
- Rilavorazioni: il vecchio report cerca parole nelle note; serve un’attribuzione
  verificata, non una penalità economica generata da una semplice ricerca testuale.
- Rimuovere dall’accredito nuovo comunicazioni, obiettivi salone/personali e
  riscatti legacy. Adeguare insieme `/points`, `/profile`, dashboard, API
  `notifications/[id]/claim-point` e impostazioni `workerBonusMap`.
- Conservare i dati legacy senza presentarli come saldo del nuovo conto.
  Non è stata verificata l’esistenza di uno storico mensile completo del vecchio saldo.
- Verificare gli endpoint e i permessi server, i tentativi concorrenti, la
  gestione delle fonti automatiche e le tre schermate prima del rilascio.

## Aggiornamento richiesto: quota manuale

La quota appuntamenti viene impostata da Steven nella pagina Gestione punti.
Non usare più il valore fisso di 5 appuntamenti × giornate. Nell’anteprima
la quota è mensile e per persona; se non impostata, il bonus extra resta in attesa.
La modifica della quota è una configurazione autorizzata, distinta dalla modifica
degli eventi. La persistenza e l’audit delle modifiche devono essere implementati
prima dell’attivazione reale.

## Decorrenza aggiornata

L’utente ha richiesto il 28 settembre 2026 di rendere tutto disponibile subito.
Decorrenza anticipata al 28 settembre 2026, Europe/Rome, senza eventi retroattivi.
Il motore usa questa data; ciò non equivale a un deploy o a un’attivazione sul sito.
Le assegnazioni reali e l’integrazione server restano da completare.

## Implementazione applicazione — aggiornamento 28 settembre

Il modulo è integrato in `/points`, con UI React e API autenticata
`/api/monthly-bonus`. I conti mensili e la configurazione sono salvati nella tabella
Setting esistente, chiave `monthly_bonus:YYYY-MM`. Le transazioni bloccano la riga
prima di verificare soglie e aggiungere eventi; una revisione protegge le anteprime
e le configurazioni da aggiornamenti concorrenti. Non serve una migrazione schema.

La direzione può assegnare livelli, quote, responsabili e Master nell'app.
Le assegnazioni non vengono inventate né importate dai dati dimostrativi.
Il registro consente eventi verificati manualmente, con autore e riferimento.
Le importazioni automatiche da timbrature, appuntamenti e rilavorazioni sono
ancora da integrare; la UI lo esplicita. Per ogni appuntamento extra il registro
richiede il totale verificato e impedisce accrediti oltre gli extra disponibili.
I cambi di livello, quota o regola che altererebbero eventi già registrati sono
bloccati e richiedono una correzione concordata.

Il nuovo conto sostituisce il vecchio: niente accrediti comunicazioni, vecchi
traguardi o riscatti; gli importi legacy restano conservati nei dati originali.
Profilo e impostazioni rimandano al nuovo Centro Punti.

**Ultima richiesta: gli euro sono nascosti allo staff per default.** Anche
l'API omette il totale in euro agli utenti non direzione. La direzione vede gli
importi e può sbloccarli dal pulsante in Gestione punti. Lo sblocco è mensile,
tracciato e ripreso nei mesi seguenti, senza attivazione automatica.

Verifiche: 382 test superati, controllo TypeScript e build produzione completati.
Il rilascio resta distinto dal completamento del codice: verificare il push e
il deploy effettivo prima di dichiarare il sito aggiornato.

## Rilavorazioni: regola automatica confermata

La scelta manuale è rimossa per i nuovi conteggi: prime 3 gratuite, malus −20
alla 6ª, 9ª, 12ª rilavorazione. La responsabile registra il singolo evento;
il server calcola franchigia e malus. I conti storici con eventi già valutati
con una regola diversa restano invariati. Nessuna penalità automatica viene
ricavata dalla ricerca testuale nelle note Controllo Cliente.

## Regole configurabili e dashboard — 28 settembre 2026

La dashboard reale include il riepilogo Centro Punti e il collegamento diretto a Gestione punti. La direzione può modificare soglie, penalità e premi per mese; ogni salvataggio registra autore, data, valori precedenti e nuovi. Gli eventi già registrati conservano i propri punti.

Il bonus lavoro fuori turno è inizialmente disattivato (0 punti). Impostando un valore positivo, dalle prossime uscite il sistema verifica una giornata esplicitamente segnata Riposo, una coppia entrata/uscita valida e nessuna assenza approvata. Esclude timbrature inserite/modificate manualmente da Admin e accredita al massimo un evento per persona e giornata. Un turno mancante non è riposo. Gli appuntamenti oltre quota restano registrati con totale verificato; il premio iniziale è 0,5 punti ed è modificabile. La malattia non comporta penalità.

Gli importi in euro restano nascosti allo staff finché la direzione non abilita la visibilità. Controlli: 391 test superati e TypeScript senza errori.
