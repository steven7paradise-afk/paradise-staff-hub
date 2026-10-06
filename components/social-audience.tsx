"use client";
import { useEffect, useState } from "react";
import { Facebook, Instagram, Target } from "lucide-react";
import styles from "./social-audience.module.css";
type Channel = {channel:string;count:number|null;target:number|null;updatedAt:string|null;state:string};
const names:Record<string,string> = {FACEBOOK:"Facebook",INSTAGRAM:"Instagram",TIKTOK:"TikTok"};
const format = (value:number) => value.toLocaleString("it-IT");
export function SocialAudience() {
  const [channels,setChannels] = useState<Channel[]>([]);
  const [canManage,setCanManage] = useState(false);
  const [editing,setEditing] = useState<string|null>(null);
  const [target,setTarget] = useState("");
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  useEffect(()=>{
    const controller=new AbortController();
    let busy=false;
    async function refresh() {
      if(document.hidden || busy) return;
      busy=true;
      try {
        const response=await fetch("/api/social-calendar/audience",{cache:"no-store",signal:controller.signal});
        if(!response.ok) throw new Error();
        const result=await response.json();
        setChannels(result.channels);setCanManage(result.canManage);setError("");
      } catch {if(!controller.signal.aborted) setError("Impossibile aggiornare i contatori. Riproveremo automaticamente.");}
      finally {busy=false;}
    }
    void refresh();const timer=setInterval(()=>void refresh(),60_000);
    document.addEventListener("visibilitychange",refresh);
    return ()=>{controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  async function save(channel:string) {
    const value=target.trim() === "" ? null : Number(target);
    if(value !== null && (!Number.isSafeInteger(value)||value<=0)) {setError("Inserisci un numero intero maggiore di zero.");return;}
    setSaving(true);setError("");
    try {
      const response=await fetch("/api/social-calendar/audience",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({channel,target:value})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error);
      setChannels(items=>items.map(item=>item.channel===channel?{...item,target:result.target}:item));setEditing(null);
    }catch(error){setError(error instanceof Error?error.message:"Obiettivo non salvato.");}finally{setSaving(false);}
  }
  return <section className={styles.audience} aria-label="Follower e obiettivi social">
    <div className={styles.audienceHeading}><div><h2>I nostri social</h2><p>@paradisebeauty.it · Follower e obiettivi</p></div><span>Aggiornamento giornaliero</span></div>
    {error && <p role="status" className={styles.audienceError}>{error}</p>}
    <div className={styles.audienceGrid}>{["FACEBOOK","INSTAGRAM","TIKTOK"].map(channel=>{
      const item=channels.find(item=>item.channel===channel);
      const percent=item?.count != null && item.target ? Math.min(100,Math.round(item.count/item.target*100)):null;
      return <article key={channel} className={styles.audienceCard} data-channel={channel}>
        <header><span className={styles.audienceIcon}>{channel === "FACEBOOK"?<Facebook size={22}/>:channel === "INSTAGRAM"?<Instagram size={22}/>:"♪"}</span><strong>{names[channel]}</strong><small>{!item?"Caricamento…":item.state === "connected"?"Collegato":item.state === "disconnected"?"Da collegare":item.state === "updating"?"Aggiornamento…":"Dato non disponibile"}</small></header>
        <div className={styles.audienceNumber}>{item?.count != null?format(item.count):"—"}<span>follower</span></div>
        <div className={styles.audienceGoal}><Target size={14}/><span>{item?.target?`Obiettivo ${format(item.target)}`:"Obiettivo da impostare"}</span>{percent !== null && <strong>{percent}%</strong>}</div>
        <div className={styles.audienceTrack}>{percent !== null && <span style={{width:`${percent}%`}}/>}</div>
        <p>{item?.count != null && item.target ? item.count >= item.target ? "Obiettivo raggiunto!" : `Mancano ${format(item.target-item.count)} follower` : item?.state === "disconnected" ? "Collega Apify per leggere i follower pubblici." : "In attesa dei dati del social."}</p>
        {item?.updatedAt && <time dateTime={item.updatedAt}>Ultimo dato: {new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(item.updatedAt))}</time>}
        {canManage && (editing === channel ? <form onSubmit={event=>{event.preventDefault();void save(channel);}} className={styles.audienceForm}><label>Follower da raggiungere<input aria-label={`Obiettivo ${names[channel]}`} type="number" min="1" step="1" max="10000000000" value={target} onChange={event=>setTarget(event.target.value)} placeholder="Nessun obiettivo" disabled={saving}/></label><button disabled={saving}>Salva</button><button type="button" disabled={saving} onClick={()=>setEditing(null)}>Annulla</button></form> : <button className={styles.audienceEdit} onClick={()=>{setEditing(channel);setTarget(item?.target?.toString()||"");}}>{item?.target?"Modifica obiettivo":"Imposta obiettivo"}</button>)}
      </article>;
    })}</div>
  </section>;
}
