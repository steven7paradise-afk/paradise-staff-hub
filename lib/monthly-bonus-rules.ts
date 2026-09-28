/** Amounts are points only. Monetary disclosure is a separate permission. */
export const DEFAULT_BONUS_RULES = {
  entryGrace:3, entryPenalty:10, breakGrace:3, breakPenalty:2,
  letterPenalty:20, appearanceGrace:2, appearancePenalty:10,
  reworkFree:3, reworkBlock:3, reworkPenalty:20,
  negativeReviewPenalty:2, positiveReviewThreshold:20, positiveReviewPoints:1,
  extraAppointmentPoints:0.5, shiftChangePoints:1, urgencyPoints:1,
  zeroReworkPoints:3, trainingPoints:2, offShiftDayPoints:0,
};
export type BonusRules = typeof DEFAULT_BONUS_RULES;
export const BONUS_RULE_FIELDS: Array<{key:keyof BonusRules;label:string;hint:string;integer?:boolean}> = [
 {key:'entryGrace',label:'Ritardi ingresso tollerati',hint:'Quanti ritardi nel mese non tolgono punti.',integer:true},
 {key:'entryPenalty',label:'Punti tolti per ritardo ingresso',hint:'Per ogni ritardo dopo la tolleranza.'},
 {key:'breakGrace',label:'Rientri pausa tollerati',hint:'Quanti rientri tardi nel mese non tolgono punti.',integer:true},
 {key:'breakPenalty',label:'Punti tolti per rientro tardi',hint:'Per ogni rientro dopo la tolleranza.'},
 {key:'letterPenalty',label:'Punti tolti per contestazione',hint:'Per ogni lettera registrata.'},
 {key:'appearanceGrace',label:'Richiami outfit tollerati',hint:'Numero mensile senza penalità.',integer:true},
 {key:'appearancePenalty',label:'Punti tolti per richiamo outfit',hint:'Per ogni richiamo oltre la tolleranza.'},
 {key:'reworkFree',label:'Rilavorazioni gratuite',hint:'Le prime del mese non tolgono punti.',integer:true},
 {key:'reworkBlock',label:'Rilavorazioni per blocco',hint:'Il malus scatta solo quando il blocco è completo.',integer:true},
 {key:'reworkPenalty',label:'Punti tolti per blocco',hint:'Non per ogni rilavorazione: solo a blocco completato.'},
 {key:'negativeReviewPenalty',label:'Recensione negativa: punti tolti',hint:'Solo se nomina la persona.'},
 {key:'positiveReviewThreshold',label:'Recensioni positive senza bonus',hint:'Il bonus parte dalla recensione successiva.',integer:true},
 {key:'positiveReviewPoints',label:'Recensione positiva: punti aggiunti',hint:'Per ogni recensione nominativa oltre soglia.'},
 {key:'extraAppointmentPoints',label:'Punti per appuntamento extra',hint:'Per ogni appuntamento oltre la quota personale mensile.'},
 {key:'shiftChangePoints',label:'Cambio turno: punti aggiunti',hint:'Per ogni cambio all’ultimo momento registrato.'},
 {key:'urgencyPoints',label:'Reperibilità: punti aggiunti',hint:'Per ogni urgenza confermata.'},
 {key:'zeroReworkPoints',label:'Junior senza rilavorazioni',hint:'Una volta, dopo la fine del mese.'},
 {key:'trainingPoints',label:'Junior: punti per formazione',hint:'Per ciascun corso verificato.'},
 {key:'offShiftDayPoints',label:'Punti per giornata lavorata fuori turno',hint:'0 = disattivato. Automatico dopo entrata e uscita in una giornata segnata Riposo.'},
];
export function bonusRules(value?: Partial<BonusRules>|null):BonusRules { return {...DEFAULT_BONUS_RULES,...value}; }
export function validateBonusRules(raw:unknown):BonusRules {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Regole non valide.');
 const values=raw as Record<string,unknown>;
 const result={...DEFAULT_BONUS_RULES};
 for(const f of BONUS_RULE_FIELDS){const v=values[f.key];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>10000||(f.integer?!Number.isInteger(v):!Number.isInteger(v*2))||(f.key==='reworkBlock'&&v<1))throw new Error(`${f.label}: inserisci ${f.integer?'un numero intero':'punti interi o mezzi punti'} valido.`);result[f.key]=v;}
 return result;
}
export function bonusRuleExplanation(r:BonusRules) {
 return [
  `Ingresso: primi ${r.entryGrace} ritardi del mese senza penalità. Dal ${r.entryGrace+1}°: −${r.entryPenalty} punti ciascuno.`,
  `Pausa: primi ${r.breakGrace} rientri tardi senza penalità. Dal ${r.breakGrace+1}°: −${r.breakPenalty} punti ciascuno.`,
  `Outfit: primi ${r.appearanceGrace} richiami senza penalità. Dal ${r.appearanceGrace+1}°: −${r.appearancePenalty} punti ciascuno.`,
  `Contestazione: −${r.letterPenalty} punti per lettera.`,
  `Rilavorazioni: prime ${r.reworkFree} gratuite. Poi −${r.reworkPenalty} punti ogni ${r.reworkBlock} rilavorazioni: alla ${r.reworkFree+r.reworkBlock}ª, ${r.reworkFree+2*r.reworkBlock}ª, ${r.reworkFree+3*r.reworkBlock}ª.`,
  `Recensione negativa nominativa: −${r.negativeReviewPenalty} punti.`,
  `Recensione positiva nominativa: +${r.positiveReviewPoints} punti dalla ${r.positiveReviewThreshold+1}ª del mese.`,
  `Appuntamenti: +${r.extraAppointmentPoints} punti per ogni appuntamento oltre la quota mensile che imposti tu. Solo Master e Autonome.`,
  `Cambio turno ultimo momento: +${r.shiftChangePoints} punti. Reperibilità confermata: +${r.urgencyPoints} punti.`,
  `Junior: +${r.trainingPoints} per corso; +${r.zeroReworkPoints} per zero rilavorazioni a mese concluso.`,
  r.offShiftDayPoints>0?`Fuori turno: +${r.offShiftDayPoints} punti per giornata di Riposo con entrata e uscita valide. Una sola volta al giorno.`:'Lavoro fuori turno: bonus disattivato finché la direzione non imposta i punti.',
  'Ogni mese riparte dalla base del livello. Il saldo non scende sotto zero e non supera il tetto.',
 ];
}
