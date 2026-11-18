import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={`appointments-route-loading ${styles.screen}`}>
      <div aria-hidden="true" className={styles.rail}>
        <span className={styles.monogram} />
        {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
      </div>
      <div aria-hidden="true" className={styles.mobileHeader}>
        <span /><span />
      </div>
      <main className={styles.main} aria-busy="true" aria-label="Appuntamenti">
        <section className={styles.toolbar}>
          <h1>Appuntamenti</h1>
          <p role="status">Caricamento del periodo selezionato…</p>
          <div aria-hidden="true" className={styles.placeholders}>
            <div className={styles.dates}><span /><span /><span /></div>
            <div className={styles.filters}><span /><span /><span /></div>
            <div className={styles.hours}>
              {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
            </div>
          </div>
        </section>
        <div aria-hidden="true" className={styles.board}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={styles.column}>
              <div className={styles.worker}><span /><span /></div>
              <div className={styles.booking}><span /><span /><span /></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
