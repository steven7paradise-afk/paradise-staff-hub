# API lavoratori per Paradise Magazzino

Due endpoint server-to-server, senza sessioni browser e senza modificare utenti,
PIN, presenze o timbrature. L'elenco e l'identificazione comprendono solo utenti
attivi che non risultano «Ex dipendente». Non è richiesto avere timbrato.

## Configurazione riservata

Impostare esclusivamente nelle variabili di ambiente runtime del servizio:

- `MAGAZZINO_API_KEY`: almeno 43 caratteri; generare 48 byte casuali con un CSPRNG
  e codificarli base64url. Non usare un prefisso `NEXT_PUBLIC_`. Non inserire il
  valore nel repository, nei comandi, nei log, nei ticket o nella documentazione.
- `MAGAZZINO_TRUST_PROXY=true`: consentito solo dopo avere verificato il confine
  di rete descritto sotto. Senza un'identità IP affidabile le richieste falliscono.
- `MAGAZZINO_ALLOWED_IPS`: IP egress esatti di Magazzino, separati da virgola,
  IPv4/IPv6; nessun nome DNS o CIDR. Una configurazione non valida fallisce chiusa.
  Se omessa rimangono obbligatori Bearer, HTTPS e limiti IP/globali.

La chiave va inviata esclusivamente dal backend Magazzino nell'intestazione
`Authorization: Bearer <chiave>`; non distribuirla al browser. Configurarla tramite
un canale riservato di gestione delle variabili, senza stamparla. Per ruotarla,
aggiornare le due applicazioni nella stessa finestra; per disabilitare subito
l'integrazione rimuovere la variabile e ricreare il container.

## Confine TLS e IP

Pubblicare il servizio solo dietro l'ingress verificato, senza porta applicativa
accessibile da Internet. L'ingress deve terminare TLS, sovrascrivere
`X-Forwarded-Proto` e aggiungere l'indirizzo del proprio peer all'estremità destra
di `X-Forwarded-For`. Il codice usa solo tale ultimo indirizzo, mai il primo IP
fornito dal client. Non abilitare forwarded headers `insecure` sull'ingress.

Se esiste un CDN/LB davanti a Traefik, configurare solo i suoi CIDR attendibili e
verificare di nuovo la catena prima di abilitare l'integrazione. Preferire anche
un middleware IPAllowList Traefik sul solo router delle due API, usando
`sourceRange` e il peer effettivo, senza `ipStrategy`, quando Magazzino ha un egress
stabile. Non limitare l'intero sito. L'allowlist applicativa è una difesa aggiuntiva
e non può stabilire autonomamente l'attendibilità degli header proxy.

## Contratto

- `POST /api/magazzino/verifica-pin`: JSON con il solo campo stringa `pin`.
  PIN completo delle timbrature, 4–6 cifre, conservando gli zeri iniziali.
  Non inviare PIN in URL, parametri, header o log.
- `GET /api/magazzino/dipendenti`: elenco minimo degli utenti attivi, ordinati
  per nome; solo `dipendente_id`, `nome`, `attivo`.
- Verifica riuscita: `{"ok":true,"dipendente_id":"esempio-id","nome":"Persona Esempio","attivo":true}`.
- PIN sconosciuto/errato, utente inattivo/ex dipendente o corrispondenza ambigua:
  `{"ok":false}`, HTTP 200. Nessuna distinzione della causa.
- Chiave assente/errata: 401; HTTPS/IP non autorizzato: 403; body/query non validi:
  400; limite: 429 con `Retry-After`; configurazione/DB indisponibili: 503.
- Body JSON massimo 256 byte, tempo massimo di lettura 5 secondi.
- Risposte sempre `Cache-Control: no-store`; nessun redirect di login né CORS.

## Limiti condivisi e costo

Finestre di 60 secondi, condivise nel database tra processi/container:

| Endpoint | Per IP | Globale |
| --- | ---: | ---: |
| Verifica PIN | 10 richieste | 60 richieste |
| Elenco | 30 richieste | 120 richieste |

Ogni richiesta autenticata consuma entrambi i contatori, inclusi tentativi
errati, body non validi e tentativi già limitati. Il limite precede bcrypt.
I contatori di sicurezza riusano `mcp_rate_buckets` con namespace separato;
non viene aggiunto alcuno schema. La sola scrittura riguarda questi contatori.
Il PIN o la chiave non fanno parte delle chiavi dei bucket.

Il controllo della chiave usa digest di lunghezza fissa e `timingSafeEqual`.
Il controllo PIN confronta sempre bcrypt, anche se il lookup indicizzato esiste.
I record legacy senza lookup vengono controllati senza aggiornarli e senza
accettare la prima corrispondenza se il PIN è ambiguo. Il costo cresce con tali
record; verificare il loro numero prima del rilascio. Nessuna scansione dei PIN
possibili, modifica o rigenerazione dei PIN è prevista.

## Verifica operativa senza dati sensibili

1. Contare in aggregato utenti attivi con hash, lookup mancanti, hash mancanti e
   lookup duplicati. Non esportare hash/lookup/PIN. Il vincolo unique impedisce
   lookup duplicati non nulli; con legacy senza lookup non si può dimostrare
   l'assenza di PIN uguali dai soli hash bcrypt salati.
2. Entrambe le richieste senza chiave devono restituire 401 JSON, senza `Location`.
3. Dal server Magazzino, leggere la chiave direttamente dall'ambiente nel processo
   di verifica; non passarla come argomento di shell. Verificare elenco e un PIN
   fornito dal lavoratore solo nel body, senza registrare input/output personali.
4. Ripetere un PIN sintetico non valido: l'undicesima richiesta nella finestra
   per IP deve restituire 429. Attendere `Retry-After` prima del riutilizzo.
5. Controllare che la timbratura e il login già esistenti funzionino invariati.

I test automatici usano identità e PIN sintetici, mai credenziali reali.
