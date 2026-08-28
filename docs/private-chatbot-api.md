# API privata Paradise Assistant

Il chatbot esterno può interrogare Paradise Assistant tramite lo stesso motore usato dall'applicazione, senza ricevere una copia completa del database.

## Endpoint

`POST https://staff-paradise.tech/api/admin-assistant`

## Autenticazione

Impostare sul server:

- `CHATBOT_INTERNAL_API_KEY`: segreto lungo e casuale condiviso esclusivamente con il chatbot privato.
- `CHATBOT_SERVICE_USER_ID`: ID di un account Paradise attivo con ruolo `ZERO`, `SUPER_ADMIN` o `ADMIN`, usato per applicare i permessi e identificare le richieste.
- `OPENAI_API_KEY`: necessaria soltanto se il sistema esterno invia messaggi naturali a Paradise Assistant. Non serve quando l'assistente chiama direttamente gli strumenti dati.

La richiesta deve includere uno dei seguenti header:

```http
Authorization: Bearer <CHATBOT_INTERNAL_API_KEY>
```

oppure:

```http
X-API-Key: <CHATBOT_INTERNAL_API_KEY>
```

## Richiesta

### Chiamata diretta consigliata

Un assistente già esistente dovrebbe leggere il catalogo con `GET /api/admin-assistant` e chiamare lo strumento necessario:

```json
{
  "tool": "get_team_status",
  "arguments": { "status": "IN_PAUSA" },
  "question": "Chi è in pausa adesso?"
}
```

La risposta contiene i dati verificati nel campo `data`. In questa modalità non viene usato un secondo modello AI.

### Domanda naturale opzionale

```json
{
  "messages": [
    { "role": "user", "content": "Quali task sono scadute?" }
  ]
}
```

Sono accettati al massimo gli ultimi 10 messaggi, con un massimo di 2.000 caratteri per messaggio.

## Risposta

```json
{
  "answer": "...",
  "links": [],
  "navigation": null,
  "pendingAction": null,
  "cards": [],
  "metrics": []
}
```

## Aree consultabili

- personale, mansioni, sedi e informazioni contrattuali consentite;
- presenze, pause, entrate e uscite;
- planning e turni;
- ferie, permessi, riposi, malattie e ritardi;
- task, checklist, commenti e avanzamento;
- documenti HR e cedolini, senza restituire il contenuto dei file;
- clienti, appuntamenti e schede Controllo Cliente;
- ordini, fatture e cassa.

L'accesso tramite chiave privata può leggere i dati e inviare comunicazioni soltanto con una conferma esplicita. Non può salvare o cancellare memorie e non può eseguire altre modifiche. Password, PIN, token, chiavi di integrazione e altri segreti non vengono esposti.

## Comunicazioni con conferma

Il chatbot può preparare un messaggio per una persona, un salone oppure l'Ufficio Paradise:

```json
{
  "tool": "prepare_communication",
  "arguments": {
    "recipient_scope": "SALONE",
    "recipient_name": "Salone Duomo",
    "task_query": null,
    "title": "Aggiornamento operativo",
    "message": "Domani la riunione inizierà alle ore 09:30."
  },
  "question": "Prepara questa comunicazione per il Salone Duomo"
}
```

La risposta contiene l'anteprima, il numero dei destinatari e `pendingAction.token`. Il bot deve mostrare destinatario, titolo e testo e chiedere: “Vuoi inviare questa comunicazione?”. Solo dopo una risposta affermativa deve inviare:

```json
{
  "confirmActionToken": "<pendingAction.token>"
}
```

Per annullare:

```json
{
  "cancelActionToken": "<pendingAction.token>"
}
```

Il token scade dopo 10 minuti e non può essere riutilizzato.

## Esempio

```bash
curl https://staff-paradise.tech/api/admin-assistant \
  -H "Authorization: Bearer $CHATBOT_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Chi è in pausa adesso?"}]}'
```
