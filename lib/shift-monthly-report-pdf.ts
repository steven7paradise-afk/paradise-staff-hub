import { jsPDF } from "jspdf";
import type { MonthlyShiftReport } from "./shift-monthly-report";
export function clientComparison(report: MonthlyShiftReport) {
  const rows = new Map<string,{name:string;salon:string;current:number;previous:number}>();
  for (const [key, list] of [["current",report.clients.staff],["previous",report.previousClients.staff]] as const) for (const row of list) {
    const id=JSON.stringify([row.name,row.salon]); const found=rows.get(id)||{name:row.name,salon:row.salon,current:0,previous:0}; found[key]=row.services;rows.set(id,found);
  }
  return [...rows.values()].sort((a,b)=>b.current-a.current||a.name.localeCompare(b.name));
}
export function monthlyShiftPdf(report: MonthlyShiftReport) {
  const pdf=new jsPDF({unit:"mm",format:"a4"});const width=174;let y=0;
  const clean=(v:unknown)=>String(v??"-").replace(/[\u2010-\u2015]/g,"-").replace(/\u2026/g,"...").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"');
  const heading=()=>{pdf.setFillColor(145,48,92);pdf.rect(0,0,210,28,"F");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(15);pdf.text("Paradise | Report mensile turni",18,13);pdf.setFontSize(9);pdf.text(`${report.current.month} | ${report.current.firstDay} - ${report.current.lastDay}`,18,21);y=38;};
  const space=(height:number)=>{if(y+height>276){pdf.addPage();heading();}};
  const text=(value:string)=>{pdf.setFont("helvetica","normal");pdf.setFontSize(9);const lines=pdf.splitTextToSize(clean(value),width) as string[];for(const line of lines){space(5);pdf.setTextColor(65,55,61);pdf.text(line,18,y);y+=4.5;}y+=3;};
  const title=(value:string)=>{space(20);pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.setTextColor(145,48,92);pdf.text(clean(value),18,y);y+=8;};
  const table=(headers:string[],rows:unknown[][],widths:number[])=>{
    const draw=(cells:unknown[],header=false)=>{
      pdf.setFont("helvetica",header?"bold":"normal");pdf.setFontSize(8);
      const lines=cells.map((c,i)=>pdf.splitTextToSize(clean(c),widths[i]-4) as string[]);
      const height=Math.max(8,Math.max(...lines.map(l=>l.length))*3.7+4);
      if(y+height>276){pdf.addPage();heading();if(!header)draw(headers,true);}
      let x=18;pdf.setFillColor(header?145:251,header?48:242,header?92:246);pdf.rect(x,y,width,height,"F");pdf.setTextColor(header?255:55,header?255:45,header?255:52);
      pdf.setFont("helvetica",header?"bold":"normal");pdf.setFontSize(8);
      lines.forEach((line,i)=>{pdf.text(line,x+2,y+4.5);x+=widths[i];});y+=height+0.4;
    };draw(headers,true);for(const row of rows)draw(row);y+=6;
  };
  const newSection=(value:string)=>{pdf.addPage();heading();title(value);};
  const pct=(v:number|null)=>v===null?"N/D":`${v.toFixed(1)}%`;
  heading();title("01 / Riepilogo mensile");
  text(`Periodo: ${report.current.firstDay} - ${report.current.lastDay}. Confronto: ${report.previous.firstDay} - ${report.previous.lastDay}. ${report.current.partial?"Dati parziali: confronto fino allo stesso giorno del mese precedente, limitato alla durata del mese.":"Confronto tra mesi completi."}`);
  table(["Indicatore","Mese selezionato","Periodo precedente"],[
    ["Verbali compilati",report.shifts.days,report.previousShifts.days||"N/D"],
    ["Compilazione obbligatoria",pct(report.shifts.completion),pct(report.previousShifts.completion)],
    ["Schede Controllo Cliente valide",report.clients.total,report.previousClients.total],
    ["Schede escluse (Errore / Finito)",report.clients.excluded,report.previousClients.excluded],
  ],[80,47,47]);
  title("Attivita clienti nel periodo");
  const difference=report.clients.total-report.previousClients.total;
  text(`${report.clients.total} schede valide rispetto a ${report.previousClients.total}: differenza ${difference>0?"+":""}${difference}${report.previousClients.total?` (${difference>0?"+":""}${(difference/report.previousClients.total*100).toFixed(1)}%)`:"; variazione percentuale non calcolabile con base zero"}.`);
  const rating=report.shifts.questionStats.find(q=>q.rating!==null);
  if(rating)text(`${rating.title}: ${rating.rating!.toFixed(2)}, su ${rating.ratingCount} risposte. Le giornate senza voto sono escluse dalla media.`);
  title("Totali per salone");
  const salonNames=new Set([...report.clients.salons,...report.previousClients.salons].map(s=>s.name));
  table(["Salone","Attuale","Precedente"],[...salonNames].map(name=>[name,report.clients.salons.find(s=>s.name===name)?.total??0,report.previousClients.salons.find(s=>s.name===name)?.total??0]),[104,35,35]);
  title("Come leggere il report");
  text("Clienti = schede valide di Controllo Cliente, non persone uniche. Le schede sono datate secondo la creazione in Europe/Rome; quelle segnate Errore o Finito sono escluse.");
  text("I verbali non hanno una sede associata: le loro statistiche sono globali. Solo Controllo Cliente e suddiviso per salone. Il questionario e cambiato nel tempo: la compilazione usa le domande attuali.");
  text("Una risposta mancante non equivale a No. I controlli descrivono quanto dichiarato nei verbali e non costituiscono una valutazione automatica o un calcolo dei bonus.");
  newSection("02 / Clienti per persona");
  text("Ogni scheda conta una volta per ciascuna persona indicata nel servizio, ma una sola volta nel totale del salone. Le somme per persona possono quindi superare il totale delle schede. In assenza di staff si usa il responsabile servizio, altrimenti Senza responsabile.");
  table(["Persona","Salone","Attuale","Precedente","Diff."],clientComparison(report).map(r=>[r.name,r.salon,r.current,r.previous,`${r.current-r.previous>0?"+":""}${r.current-r.previous}`]),[54,51,23,25,21]);
  if(!report.clients.total)text("Nessuna scheda valida nel periodo selezionato.");
  text("Sono conservate anche le etichette presenti nei dati, come Senza responsabile o NO SHOW: non vengono considerate automaticamente nominativi verificati dello staff.");
  newSection("03 / Analisi dei verbali");
  text("Risposte = giornate con un valore salvato. Mancanti = verbali senza quella risposta. N/D indica assenza di verbali nel periodo. Il confronto e per ID domanda; le modifiche di formato possono limitarne la confrontabilita.");
  table(["Domanda","Risposte attuali","Precedente","Mancanti","Si / No","Voto medio"],report.shifts.questionStats.map(q=>{const prev=report.previousShifts.questionStats.find(p=>p.id===q.id);return[q.title,`${q.answered}/${report.shifts.days}`,report.previousShifts.days&&prev?`${prev.answered}/${report.previousShifts.days}`:"N/D",q.missing,`${q.yes}/${q.no}`,q.rating===null?"-":`${q.rating.toFixed(2)} (n=${q.ratingCount})`];}),[57,25,25,20,20,27]);
  title("Segnalazioni strutturate");
  table(["Domanda","Voci registrate"],report.shifts.questionStats.filter(q=>q.entries>0).map(q=>[q.title,q.entries]),[134,40]);
  text("Le voci sono note, righe di timeline o collegamenti a task salvati. Non rappresentano necessariamente problemi distinti; il collegamento a una task non prova che sia ancora aperta o risolta.");
  text("Si / No conta soltanto risposte globali esplicite. Le checklist per persona sono nelle sezioni successive. I voti mancanti non vengono trasformati in zero.");
  let section=4;
  const groups=new Map<string,typeof report.shifts.staff>();
  for(const row of report.shifts.staff)groups.set(row.question,[...(groups.get(row.question)||[]),row]);
  const ordered=[...groups].sort(([a],[b])=>{
    const rank=(s:string)=>/presenti/i.test(s)?0:/presentabil/i.test(s)?1:/pause/i.test(s)?2:3;
    return rank(a)-rank(b)||a.localeCompare(b);
  });
  for(const [question,entries] of ordered){
    const controlOrder=["Puntuale","Ritardo","Assente","Malattia","Divisa pulita e completa","Capelli ordinati","Aspetto personale curato","Postazione in ordine","0","15min","30min","45min","1 ora"];
    const controls=[...new Set(entries.map(r=>r.control))].sort((a,b)=>(controlOrder.includes(a)?controlOrder.indexOf(a):99)-(controlOrder.includes(b)?controlOrder.indexOf(b):99)||a.localeCompare(b));
    const names=[...new Set(entries.map(r=>r.name))].sort((a,b)=>a.localeCompare(b));
    newSection(`${String(section++).padStart(2,"0")} / ${question}`);
    text("Una riga per persona. Ogni cella indica SI / NO / NON SELEZIONATO. Il totale dei tre numeri e il numero di giornate osservate per quel controllo. Il trattino indica nessun dato, non un esito negativo.");
    for(let start=0;start<controls.length;start+=5){
      const cols=controls.slice(start,start+5);
      if(start)title("Altri controlli della stessa domanda");
      const colWidth=(174-54)/cols.length;
      table(["Persona",...cols],names.map(name=>[name,...cols.map(control=>{const r=entries.find(r=>r.name===name&&r.control===control);return r?`${r.yes} / ${r.no} / ${r.unselected}`:"-";})]),[54,...cols.map(()=>colWidth)]);
    }
    text("Le caselle non selezionate restano distinte dai No espliciti. Non sono assenze, non conformita o pause mancanti certificate. Formati precedenti a testo libero o risposte globali non sono convertiti in checklist.");
  }
  newSection(`${String(section).padStart(2,"0")} / Registro giornaliero`);
  text("Tracciabilita delle giornate incluse. Una domanda obbligatoria e completa quando e presente la risposta e, se richiesto, il relativo approfondimento.");
  table(["Data","Obbligatorie complete","Compilazione"],report.shifts.daily.map(d=>[d.day,`${d.completed}/${d.total}`,d.total?`${Math.round(d.completed/d.total*100)}%`:"N/D"]),[64,60,50]);
  text(`Domande storiche non piu attive: ${report.shifts.legacyQuestions}. I relativi valori restano nel database e non sono attribuiti alle nuove domande. Generato il ${new Date(report.generatedAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}. Fonte: Staff Hub / Neon.`);
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.setTextColor(110,100,105);pdf.text("Paradise Beauty | Uso interno",18,287);pdf.text(`${i} / ${pages}`,192,287,{align:"right"});}
  return pdf;
}
