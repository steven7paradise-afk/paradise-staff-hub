"use client";

import { FormEvent, useRef, useState } from "react";
import { Camera, KeyRound, Upload } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";

export function ProfileSettings({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(photoUrl);
  const [photoStatus, setPhotoStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function uploadPhoto(file?: File) {
    if (!file) return;
    setLoading(true);
    setPhotoStatus("");
    const form = new FormData();
    form.append("photo", file);
    const response = await fetch("/api/profile/photo", { method: "POST", body: form });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setPhotoStatus(result.error ?? "Foto non caricata.");
    setImage(result.photoUrl);
    setPhotoStatus("Foto profilo aggiornata.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword !== confirmation) return setPasswordStatus("Le nuove password non coincidono.");
    setLoading(true);
    setPasswordStatus("");
    const response = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setPasswordStatus(result.error ?? "Password non modificata.");
    event.currentTarget.reset();
    setPasswordStatus("Password aggiornata correttamente.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Foto profilo</h2>
        <p className="mt-1 text-sm text-black/50">La foto apparira nella tua area personale.</p>
        <div className="mt-6 flex items-center gap-5">
          <div className="grid size-24 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-3xl font-semibold">
            {image ? <img src={image} alt={name} className="size-full object-cover" /> : name.slice(0, 1)}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
          <Button variant="soft" disabled={loading} onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" /> Carica foto
          </Button>
        </div>
        {photoStatus ? <p className="mt-4 rounded-xl bg-paradise-nude p-3 text-sm">{photoStatus}</p> : null}
        <p className="mt-4 flex items-center gap-2 text-xs text-black/45"><Upload className="size-3.5" /> Immagini JPG o PNG, massimo 5 MB.</p>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5" /> Modifica password</h2>
        <form className="mt-5 space-y-3" onSubmit={updatePassword}>
          <Field name="currentPassword" type="password" placeholder="Password attuale" required />
          <Field name="newPassword" type="password" placeholder="Nuova password" minLength={8} required />
          <Field name="confirmation" type="password" placeholder="Conferma nuova password" minLength={8} required />
          {passwordStatus ? <p className="rounded-xl bg-paradise-nude p-3 text-sm">{passwordStatus}</p> : null}
          <Button type="submit" disabled={loading}>Salva password</Button>
        </form>
      </Card>
    </div>
  );
}
