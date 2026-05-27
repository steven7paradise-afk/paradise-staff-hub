"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { Button, Card } from "@/components/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function AppInstallPanel({ apkUrl }: { apkUrl?: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setMessage("Sul tablet apri il menu del browser e scegli 'Aggiungi alla schermata Home'.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage(choice.outcome === "accepted" ? "App installata sul dispositivo." : "Installazione annullata.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paradise-softPink text-paradise-noir">
            <Smartphone className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/40">App tablet</p>
            <h2 className="mt-2 text-2xl font-semibold">Installa Paradise Staff Hub</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
              Questa opzione apre il sito come app, senza barra del browser, sempre collegata al database e agli ultimi aggiornamenti online.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={installApp}>
            <Smartphone className="size-4" />
            Installa su questo dispositivo
          </Button>
          {apkUrl ? (
            <a href={apkUrl} download>
              <Button variant="soft">
                <Download className="size-4" />
                Scarica APK
              </Button>
            </a>
          ) : (
            <Button variant="soft" disabled>
              <Download className="size-4" />
              APK non caricato
            </Button>
          )}
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium text-black/65">{message}</p> : null}
      </Card>

      <Card className="p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/40">Configurazione APK</p>
        <h2 className="mt-2 text-xl font-semibold">File Android ufficiale</h2>
        <p className="mt-2 text-sm leading-6 text-black/55">
          Quando generiamo o carichiamo il file Android, basta impostare in Netlify la variabile:
        </p>
        <code className="mt-4 block rounded-2xl bg-paradise-noir px-4 py-3 text-sm font-semibold text-white">
          NEXT_PUBLIC_ANDROID_APK_URL
        </code>
        <p className="mt-4 text-sm leading-6 text-black/55">
          Il pulsante “Scarica APK” comparira automaticamente nel pannello Super Admin.
        </p>
        <a
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#B05B6A]"
          href="https://paradise-staff-hub.netlify.app/tablet-clock"
          target="_blank"
          rel="noreferrer"
        >
          Apri Tablet Clock
          <ExternalLink className="size-4" />
        </a>
      </Card>
    </div>
  );
}
