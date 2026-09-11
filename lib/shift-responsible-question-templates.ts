import type { ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";

export type ShiftQuestionnaireScope = "OPENING" | "SERVICE" | "CLOSING" | "COMPLETE";

type TemplateQuestion = Omit<ShiftResponsibleQuestion, "id">;

const opening: TemplateQuestion[] = [
  { title: "Il salone è pronto per l'apertura?", description: "Controlla ordine, pulizia, luci e postazioni.", answerType: "YES_NO", followUpYes: "", followUpNo: "Descrivi cosa manca e chi se ne sta occupando." },
  { title: "Tutto il personale previsto è presente?", description: "Verifica presenze e copertura iniziale.", answerType: "YES_NO", followUpYes: "", followUpNo: "Indica chi manca e come è stata organizzata la copertura." },
  { title: "Ci sono ritardi comunicati?", description: "Considera il personale previsto nel turno.", answerType: "YES_NO", followUpYes: "Indica nome, orario previsto e gestione del ritardo.", followUpNo: "" },
  { title: "L'agenda della giornata è stata controllata?", description: "Verifica appuntamenti, tempi e richieste particolari.", answerType: "YES_NO", followUpYes: "", followUpNo: "Indica cosa deve ancora essere verificato." },
  { title: "Prodotti e attrezzature sono disponibili?", description: "Controlla ciò che serve per i servizi programmati.", answerType: "YES_NO", followUpYes: "", followUpNo: "Elenca ciò che manca e la soluzione prevista." },
  { title: "Priorità per l'inizio del turno", description: "Scrivi attività urgenti o indicazioni per il team.", answerType: "TEXT", followUpYes: "", followUpNo: "" },
];

const service: TemplateQuestion[] = [
  { title: "Il personale è presente secondo il programma?", description: "Verifica eventuali assenze o cambi durante il turno.", answerType: "YES_NO", followUpYes: "", followUpNo: "Indica chi manca e come è stata coperta la posizione." },
  { title: "Ci sono clienti con attese oltre il previsto?", description: "Considera ritardi che richiedono un intervento.", answerType: "YES_NO", followUpYes: "Indica cliente, durata dell'attesa e soluzione adottata.", followUpNo: "" },
  { title: "Ci sono stati reclami o disservizi?", description: "Registra solo situazioni che richiedono un seguito.", answerType: "YES_NO", followUpYes: "Descrivi il problema, la persona coinvolta e la soluzione proposta.", followUpNo: "" },
  { title: "Le postazioni restano ordinate e operative?", description: "Controlla pulizia, materiali e sicurezza.", answerType: "YES_NO", followUpYes: "", followUpNo: "Descrivi la postazione e l'intervento necessario." },
  { title: "Le scorte sono sufficienti per terminare il turno?", description: "Verifica prodotti e materiali ad alta rotazione.", answerType: "YES_NO", followUpYes: "", followUpNo: "Elenca i prodotti mancanti o quasi terminati." },
  { title: "Ci sono attività urgenti ancora aperte?", description: "Considera clienti, team, ordini e manutenzione.", answerType: "YES_NO", followUpYes: "Elenca le attività, il responsabile e la scadenza.", followUpNo: "" },
  { title: "Nota operativa del turno", description: "Aggiungi informazioni utili che non rientrano nei controlli precedenti.", answerType: "TEXT", followUpYes: "", followUpNo: "" },
];

const closing: TemplateQuestion[] = [
  { title: "Tutti gli appuntamenti risultano conclusi o riprogrammati?", description: "Verifica che non restino clienti senza esito.", answerType: "YES_NO", followUpYes: "", followUpNo: "Indica gli appuntamenti da completare o ricontattare." },
  { title: "La chiusura cassa risulta corretta?", description: "Controlla eventuali differenze prima della chiusura.", answerType: "YES_NO", followUpYes: "", followUpNo: "Indica la differenza e le verifiche già effettuate." },
  { title: "Postazioni e aree comuni sono pulite e ordinate?", description: "Verifica che il salone sia pronto per il giorno successivo.", answerType: "YES_NO", followUpYes: "", followUpNo: "Indica le aree da sistemare e chi se ne occuperà." },
  { title: "Attrezzature e impianti sono stati messi in sicurezza?", description: "Controlla spegnimento, ricarica e corretta conservazione.", answerType: "YES_NO", followUpYes: "", followUpNo: "Descrivi ciò che resta da mettere in sicurezza." },
  { title: "Ci sono prodotti da riordinare?", description: "Segnala scorte terminate o sotto il minimo.", answerType: "YES_NO", followUpYes: "Elenca prodotto, quantità disponibile e priorità.", followUpNo: "" },
  { title: "Restano problemi o reclami da seguire?", description: "Registra soltanto i casi non ancora risolti.", answerType: "YES_NO", followUpYes: "Descrivi il caso, il referente e il prossimo passo.", followUpNo: "" },
  { title: "Passaggio di consegne", description: "Scrivi ciò che il responsabile successivo deve sapere.", answerType: "TEXT", followUpYes: "", followUpNo: "" },
];

export function shiftQuestionnaireTemplate(scope: ShiftQuestionnaireScope): ShiftResponsibleQuestion[] {
  const source = scope === "OPENING"
    ? opening
    : scope === "SERVICE"
      ? service
      : scope === "CLOSING"
        ? closing
        : [...opening, ...service.slice(1, 6), ...closing];

  const seen = new Set<string>();
  return source
    .filter((question) => {
      const key = question.title.toLocaleLowerCase("it-IT");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map((question, index) => ({ ...question, id: `generated-${scope.toLowerCase()}-${index}` }));
}
