import { jsPDF } from 'jspdf';
import type { MonthlyStaffResult } from './client-control-monthly-report';

export function createClientControlMonthlyPdf(month: string, people: MonthlyStaffResult[], now = new Date()) {
  const doc = new jsPDF(); let y = 19;
  doc.setLineHeightFactor(1.35);
  const label = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(new Date(`${month}-01T12:00:00Z`));
  const current = new Intl.DateTimeFormat('sv-SE', {year:'numeric',month:'2-digit',timeZone:'Europe/Rome'}).format(now);
  const partial = month >= current;
  const clean = (s: string) => s.replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[’]/g,"'");
  const text = (s: string, size = 9.5, bold = false) => {
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(35,39,50);
    const lines = doc.splitTextToSize(clean(s),176) as string[];
    if(y+lines.length*size*.48>276){doc.addPage();y=22;}
    doc.text(lines,17,y);y+=lines.length*size*.48+5;
  };
  const title = (s:string, section='PARADISE / REPORT MENSILE', subtitle?:string) => {
    text(section,8); text(s,27);
    text(subtitle || `Corso Buenos Aires | ${label}${partial ? ' | dati parziali' : ''}`,10);
    y+=4;
  };
  const page = (s:string, section:string, subtitle:string) => {doc.addPage();y=19;title(s,section,subtitle);};
  const box = (heading:string,body:string) => {
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);
    const head=doc.splitTextToSize(clean(heading),164) as string[];
    doc.setFont('helvetica','normal');
    const lines=doc.splitTextToSize(clean(body),164) as string[];
    const height=(head.length+lines.length)*4.6+12;
    if(y+height>272){doc.addPage();y=19;}
    doc.setFillColor(248,241,245);doc.setDrawColor(234,213,224);doc.rect(17,y,176,height,'FD');
    doc.setTextColor(35,39,50);doc.setFont('helvetica','bold');doc.text(head,22,y+7);
    doc.setFont('helvetica','normal');doc.text(lines,22,y+8+head.length*4.6);
    y+=height+6;
  };
  const table = (heads:string[], rows:string[][], widths:number[]) => {
    const row = (cells:string[],header:boolean,index:number) => {
      doc.setFont('helvetica',header?'bold':'normal');doc.setFontSize(8);
      const lines=cells.map((v,i)=>doc.splitTextToSize(clean(v),widths[i]-6) as string[]);
      const h=Math.max(...lines.map(l=>l.length))*3.8+4;
      if(y+h>275){doc.addPage();y=22; if(!header) row(heads,true,0);}
      doc.setFillColor(...(header?[150,53,95]:index%2?[247,248,250]:[255,255,255]) as [number,number,number]);doc.rect(17,y,176,h,'F');
      doc.setTextColor(...(header?[255,255,255]:[35,39,50]) as [number,number,number]);
      let x=17;lines.forEach((l,i)=>{doc.text(l,x+3,y+4.5);x+=widths[i];});y+=h;
    };
    row(heads,true,0);rows.forEach((r,i)=>row(r,false,i));y+=9;
  };
  const active=people.filter(p=>p.clients>0).sort((a,b)=>b.clients-a.clients||a.name.localeCompare(b.name));
  const metric=(n:number,d:number)=>`${n} / ${d}\n${d?(100*n/d).toFixed(1).replace('.',','):'0'}%`;
  const leaders=(key:'clients'|'both'|'reviews')=>{const max=Math.max(0,...active.map(p=>p[key]));return max?active.filter(p=>p[key]===max).map(p=>`${p.name} (${max})`).join(', '):'Nessun dato positivo registrato';};
  const clock=people.filter(p=>p.clockDays>0).sort((a,b)=>a.totalMinutes-b.totalMinutes||a.name.localeCompare(b.name));
  const volume=[...active].sort((a,b)=>b.clients-a.clients||a.name.localeCompare(b.name))[0];
  const quality=[...active].sort((a,b)=>b.both-a.both||b.reviews-a.reviews||a.name.localeCompare(b.name))[0];
  const min=clock[0]?.totalMinutes;
  const comparison=volume && quality && volume.name!==quality.name ? [volume,quality] : active.slice(0,2);
  const percent=(n:number,d:number)=>(d?100*n/d:0).toFixed(1).replace('.',',')+'%';
  title('Risultati, cura del cliente\ne puntualità', 'PARADISE / REPORT MENSILE', `Corso Buenos Aires | ${label}${partial?' | dati parziali':''}\nAggiornamento dati: ${new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeZone:'Europe/Rome'}).format(now)} | Uso interno`);
  text('Chi emerge dai dati',18);
  box(volume ? `${volume.name.split(' ')[0]}: il volume più alto` : 'Il volume più alto', `Più appuntamenti con scheda e nota principale completate: ${leaders('clients')}. Sono appuntamenti, non persone uniche.`);
  box(quality ? `${quality.name.split(' ')[0]}: risultati da prendere in considerazione` : 'Documentazione del servizio', quality ? `${quality.clients} schede completate, ${quality.both} con foto/video prima e dopo (${percent(quality.both,quality.clients)}). Recensioni segnate: ${quality.reviews} (${percent(quality.reviews,quality.clients)}). ${quality.clockDays ? `Ritardi: ${quality.entryMinutes} minuti all'ingresso e ${quality.breakMinutes} dalla pausa, su ${quality.clockDays} giorni con ingresso.` : 'Nessun ingresso registrato: puntualità non valutabile.'}` : 'Nessuna scheda completata con nota nel mese.');
  box(clock.length && clock.filter(p=>p.totalMinutes===min).length===1 ? `${clock[0].name.split(' ')[0]}: il minor ritardo registrato` : 'Il minor ritardo registrato', clock.length ? `${clock.filter(p=>p.totalMinutes===min).map(p=>`${p.name}: ${p.totalMinutes} minuti su ${p.clockDays} giorni con ingresso`).join('; ')}. Il risultato riguarda la puntualità; documentazione e volume si leggono separatamente.` : 'Timbrature non presenti: nessuna graduatoria di puntualità.');
  text('Indicazione per il confronto interno',17);
  if(volume && quality && volume.name!==quality.name) {
    const moreDocumented=quality.both>volume.both && quality.reviews>volume.reviews;
    const morePunctual=quality.clockDays>0 && volume.clockDays>0 && quality.totalMinutes<volume.totalMinutes;
    text(`${quality.name.split(' ')[0]} merita attenzione per ${moreDocumented && morePunctual ? 'la combinazione di più foto/video e recensioni registrate con meno ritardi' : 'la documentazione del servizio'}. ${volume.name.split(' ')[0]} si distingue per il maggior numero di appuntamenti documentati. Non assegniamo un punteggio unico: volume, percentuali di compilazione e puntualità restano visibili separatamente.`);
  } else {
    text(volume ? `${volume.name} si distingue per il volume e la documentazione registrata. Per riconoscere l'impegno considera anche puntualità e percentuali. Non assegniamo un punteggio unico: ogni indicatore resta visibile separatamente.` : 'Dati insufficienti per evidenziare un collaboratore.');
  }
  text('Le spunte non dimostrano da sole una recensione richiesta o pubblicata, né verificano i file. Foto e video sono una voce unica. Non segnato non significa necessariamente non fatto.',8);
  page('Chi segue più clienti','01 / ATTIVITÀ E DOCUMENTAZIONE','Solo schede completate con nota, attribuite al collaboratore principale.\nLe percentuali si riferiscono alle schede della singola persona.');
  table(['Collaboratore','Schede','Prima','Dopo','Entrambe','Recensioni'],active.map(p=>[p.name,String(p.clients),metric(p.before,p.clients),metric(p.after,p.clients),metric(p.both,p.clients),metric(p.reviews,p.clients)]),[48,20,27,27,27,27]);
  if(!active.length)text('Nessuna scheda completata con nota nel mese selezionato.');
  text('Come leggere i risultati',17);
  if(quality) text(`${quality.name.split(' ')[0]} ha il maggior numero di schede con foto/video prima e dopo: ${quality.both} (${percent(quality.both,quality.clients)}). Per le recensioni segnate emerge: ${leaders('reviews')}. ${volume && volume.name!==quality.name ? `${volume.name.split(' ')[0]} registra ${volume.both} coppie prima/dopo (${percent(volume.both,volume.clients)}) e ${volume.reviews} recensioni (${percent(volume.reviews,volume.clients)}).` : ''}`);
  const always=active.filter(p=>p.both===p.clients);
  text(always.length?`Prima e dopo segnati sul 100% delle proprie schede: ${always.map(p=>p.name).join(', ')}.`:'Nessun collaboratore ha foto/video prima e dopo segnati su tutte le proprie schede.');
  text('Le percentuali hanno come base le schede del singolo collaboratore. Non segnato non significa necessariamente non fatto. Foto e video sono una voce unica; la spunta recensione non prova una richiesta né una pubblicazione.',9);
  text(`Perimetro: ${active.length} collaboratori con attività, ${active.reduce((n,p)=>n+p.clients,0)} schede. Il riepilogo generale può comprendere altri assegnatari o sedi.`,8);
  page('Chi accumula meno ritardo','02 / PUNTUALITÀ','Minuti oltre le soglie previste dal sistema. Ingresso e pausa separati.\nOrdinamento per totale crescente.');
  table(['Collaboratore','Giorni ingresso','Ingresso min','Pausa min','Totale min','Giorni ritardo'],clock.map(p=>[p.name,String(p.clockDays),String(p.entryMinutes),String(p.breakMinutes),String(p.totalMinutes),String(p.lateDays)]),[51,25,25,25,25,25]);
  if(comparison.length===2){
    const [a,b]=comparison;
    text(`Il confronto ${a.name.split(' ')[0]} / ${b.name.split(' ')[0]}`,17);
    table(['Indicatore',a.name,b.name],[
      ['Schede completate',String(a.clients),String(b.clients)],
      ['Foto/video prima + dopo',`${a.both} (${percent(a.both,a.clients)})`,`${b.both} (${percent(b.both,b.clients)})`],
      ['Recensioni segnate',`${a.reviews} (${percent(a.reviews,a.clients)})`,`${b.reviews} (${percent(b.reviews,b.clients)})`],
      ['Ritardi ingresso / pausa',`${a.entryMinutes} / ${a.breakMinutes} min`,`${b.entryMinutes} / ${b.breakMinutes} min`],
      ['Giorni con ingresso registrato',String(a.clockDays),String(b.clockDays)]
    ],[84,46,46]);
    text(`${b.name.split(' ')[0]} registra ${b.entryMinutes} minuti di ritardo all'ingresso e ${b.breakMinutes} dalla pausa, rispetto ai ${a.entryMinutes} e ${a.breakMinutes} di ${a.name.split(' ')[0]}. Il confronto mette accanto volume, documentazione e puntualità: non basta un solo numero per valutare l'impegno.`,8);
  }
  text('I minuti sono calcolati oltre le soglie previste dal sistema. Le timbrature mancanti non sono considerate puntualità. I giorni con ingresso non equivalgono a giorni programmati o ore lavorate. Totali non normalizzati per durata del turno.',9);
  const noClock=people.filter(p=>!p.clockDays);
  if(noClock.length)text(`Senza ingressi registrati: ${noClock.map(p=>p.name).join(', ')}. Non inclusi nella graduatoria di puntualità.`,9);
  page('Cosa valorizzare e verificare','03 / COMPLETEZZA E CRITERI','Indicatori aggiuntivi per il confronto mensile, senza mescolare quantità e qualità.');
  table(['Collaboratore','Provenienza compilata','Completate senza nota','Da completare'],active.map(p=>[p.name,metric(p.discovery,p.clients),String(p.missing),String(p.pending)]),[56,40,40,40]);
  text('Criteri del report',17);
  text('Una scheda per appuntamento, attribuita al principale, mai automaticamente a chi la salva. Se la stessa persona svolge anche il secondario conta una sola volta. Il volume non indica clienti unici.',9);
  text(`Personale attualmente attivo di Corso Buenos Aires, schede del salone nel mese. Data appuntamento, altrimenti data creazione (${active.reduce((n,p)=>n+p.fallback,0)} casi). I filtri di ricerca cliente e collaboratore della pagina non limitano questo report mensile del salone.`,9);
  text('Le schede da completare possono riguardare servizi non ancora conclusi. Note mancanti e collegamenti vanno verificati prima di valutare il personale. Ferie, malattie e permessi non sono criteri di merito; prodotti esclusi per il precedente problema della spunta predefinita.',9);
  text('Fonti: Controllo cliente, agenda Cowlendar, turni e timbrature di Paradise Staff Hub. Il PDF è ricalcolato al download: eventuali correzioni dei dati aggiornano anche i mesi passati.',9);
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(232,220,228);doc.line(17,282,193,282);doc.setFontSize(8);doc.setTextColor(104,112,128);doc.text(`Paradise / ${label}`,17,288);doc.text(`${i} / ${pages}`,193,288,{align:'right'});}
  return doc.output('arraybuffer');
}
