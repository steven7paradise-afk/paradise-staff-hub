import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const endpoint = 'https://www.staff-paradise.tech/api/shopify/order-block';
const states = { NEW: 'Da ordinare', PREPARING: 'In preparazione', ORDERED: 'Ordinato · in arrivo', READY: 'Pronto · azione richiesta', COMPLETED: 'Consegnato' };
export default () => render(<OrderBlock />, document.body);
function OrderBlock() {
  const orderId = shopify.data.selected?.[0]?.id;
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function request(method = 'GET', body) {
    const token = await shopify.auth.idToken();
    if (!token) throw new Error('Sessione Shopify non disponibile. Ricarica la pagina.');
    const response = await fetch(`${endpoint}?orderId=${encodeURIComponent(orderId || '')}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({ error: 'Servizio non disponibile. Riprova.' }));
    if (!response.ok) throw new Error(data.error || 'Richiesta non riuscita.');
    return data;
  }
  async function load() {
    setBusy(true); setError(''); setMessage('');
    try { const data = await request(); setOrder(data); setStatus(data.status); }
    catch (err) { setOrder(null); setError(err.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { setOrder(null); setNote(''); load(); }, [orderId]);
  async function save() {
    if (!order || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await request('POST', { orderId, status, note, version: order.version });
      setNote('');
      const data = await request(); setOrder(data); setStatus(data.status);
      setMessage('Stato aggiornato su Shopify e nella bacheca Staff Hub.');
    } catch (err) { setError(`${err.message} Premi Aggiorna per verificare lo stato prima di riprovare.`); }
    finally { setBusy(false); }
  }
  const editable = order && Object.prototype.hasOwnProperty.call(states, order.status);
  const last = order?.lastUpdate;
  return <s-admin-block heading="Gestione ordine Paradise">
    <s-stack gap="base">
      {busy && <s-text>Aggiornamento in corso…</s-text>}
      {error && <s-banner tone="critical">{error}</s-banner>}
      {message && <s-banner tone="success">{message}</s-banner>}
      {order && <s-text><s-text type="strong">{order.name}</s-text> · {states[order.status] || order.status}</s-text>}
      {editable && <>
        <s-select label="Stato ordine" value={status} disabled={busy} onChange={event => setStatus(event.currentTarget.value)}>
          {Object.entries(states).map(([value, label]) => <s-option key={value} value={value}>{label}</s-option>)}
        </s-select>
        <s-text-area label="Nota operativa" value={note} maxLength={2000} disabled={busy} onInput={event => setNote(event.currentTarget.value)} placeholder="Descrivi l’aggiornamento" />
        <s-button variant="primary" disabled={busy || (!note.trim() && status === order.status)} onClick={save}>Salva aggiornamento</s-button>
      </>}
      {last?.at && <s-text>Ultimo aggiornamento: {last.by || 'Staff'} · {new Date(last.at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}{last.note ? ` — ${last.note}` : ''}</s-text>}
      <s-text>Stato di lavorazione interno. Pagamento e spedizione restano invariati.</s-text>
      <s-stack direction="inline" gap="base">
        <s-button disabled={busy} onClick={load}>Aggiorna</s-button>
        <s-link href="https://www.staff-paradise.tech/service-forms" target="_blank">Apri Staff Hub</s-link>
      </s-stack>
    </s-stack>
  </s-admin-block>;
}
