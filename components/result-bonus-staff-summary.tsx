import Link from "next/link";
import type { PublishedDailyBonus } from "@/lib/result-bonus-delivery";
import styles from "@/app/premio-risultato/dinamiche/dinamiche.module.css";

export function ResultBonusStaffSummary({ month, earnings }: { month: string; earnings: PublishedDailyBonus[] }) {
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "Europe/Rome" });
  const money = (value: number) => value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  return <main className={styles.page}>
    <Link href="/profile" className={styles.back}>Torna al profilo</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}>{label}</span><h1>Il tuo guadagno giornaliero</h1><p>Ricevi il riepilogo nell’app dopo la timbratura di uscita.</p></div></header>
    <section className={`${styles.section} ${styles.info}`}>
      <h2>Giornate comunicate</h2>
      {!earnings.length ? <p>Non ci sono ancora importi comunicati per questo mese.</p> : <>
        <p>Totale comunicato: <strong>{money(earnings.reduce((sum, day) => sum + day.amount, 0))}</strong></p>
        {earnings.map((day) => <div key={day.date} className={styles.award}><strong><span>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}</span><span>{money(day.amount)}</span></strong></div>)}
      </>}
    </section>
  </main>;
}
