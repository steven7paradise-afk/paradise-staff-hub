import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/lib/dashboard-settings";
import { ArrowLeft, Calendar, ExternalLink, Share2, Sparkles, Tag, Upload, FileText, CheckCircle2 } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

export const dynamic = "force-dynamic";

export default async function PromoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/login");

  const { id } = await params;

  // Retrieve dashboard settings from DB
  const dashboardSettingRaw = await prisma.setting.findUnique({
    where: { key: DASHBOARD_SETTINGS_KEY },
  }).catch(() => null);

  const dashboardVal = (dashboardSettingRaw?.value as any) || {};
  const promos = Array.isArray(dashboardVal?.promos) ? dashboardVal.promos : DEFAULT_DASHBOARD_SETTINGS.promos;

  const promo = promos.find((p: any) => String(p.id) === String(id)) || (id === "default-promo" ? DEFAULT_DASHBOARD_SETTINGS.promos[0] : null);

  if (!promo) {
    notFound();
  }

  const role = session.user.role || "DIPENDENTE";
  const user = {
    id: session.user.id,
    name: session.user.name || "Staff",
    email: session.user.email || "",
    role: session.user.role,
    locationName: session.user.sedeId ? "Salone" : null,
  };

  const matUrl = promo.materialeGraficoUrl || "/documents";
  const isMatExternal = matUrl.startsWith("http://") || matUrl.startsWith("https://");

  const bannerImgUrl = promo.image || promo.bannerUrl;
  const isBannerExternal = bannerImgUrl ? (bannerImgUrl.startsWith("http://") || bannerImgUrl.startsWith("https://") || bannerImgUrl.startsWith("/api/drive-image")) : false;

  return (
    <AppShell title={promo.title || "Promozione"} subtitle={promo.subtitle || "Dettaglio promozione"} role={role}>
      <div className="max-w-4xl mx-auto space-y-6 pb-16 text-left">
        
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition"
        >
          <ArrowLeft size={16} />
          <span>Torna alla Dashboard</span>
        </Link>

        {/* Promo Header Card */}
        <div className="bg-neutral-950 text-white rounded-[32px] overflow-hidden shadow-2xl border border-neutral-800">
          
          {/* Banner Graphic Image if available */}
          {bannerImgUrl ? (
            <div className="w-full max-h-[380px] overflow-hidden bg-neutral-900 flex items-center justify-center border-b border-neutral-800 relative">
              <img
                src={isBannerExternal ? resolveDrivePhotoUrl(bannerImgUrl) : bannerImgUrl}
                alt={promo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            </div>
          ) : null}

          <div className="p-8 sm:p-12 space-y-6 relative">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
                  {promo.subtitle || "PROMOZIONALE ATTIVA"}
                </span>
              </div>

              {promo.badge ? (
                <span className="bg-neutral-900 border border-neutral-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-neutral-300">
                  {promo.badge}
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-wide text-white uppercase leading-tight">
                {promo.title}
              </h1>

              {promo.expirationDate ? (
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-400">
                  <Calendar size={14} className="text-red-500" />
                  <span>Valida fino al {promo.expirationDate}</span>
                </div>
              ) : null}
            </div>

            {/* Description Body */}
            <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-6 sm:p-8 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Dettagli & Istruzioni per lo Staff</h3>
              <p className="text-sm sm:text-base text-neutral-300 font-normal leading-relaxed whitespace-pre-line">
                {promo.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              {promo.ctaUrl ? (
                <Link
                  href={promo.ctaUrl}
                  className="bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-black uppercase tracking-wider px-7 py-3.5 rounded-xl flex items-center gap-2 transition shadow-md active:scale-95"
                >
                  <Share2 size={16} />
                  <span>{promo.ctaText || "CONDIVIDI / APRI RISORSA"}</span>
                </Link>
              ) : null}

              {matUrl ? (
                isMatExternal ? (
                  <a
                    href={matUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-neutral-700 hover:border-neutral-500 text-white text-xs font-black uppercase tracking-wider px-7 py-3.5 rounded-xl transition flex items-center gap-2"
                  >
                    <FileText size={16} />
                    <span>Materiale Grafico (Drive)</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <Link
                    href={matUrl}
                    className="border border-neutral-700 hover:border-neutral-500 text-white text-xs font-black uppercase tracking-wider px-7 py-3.5 rounded-xl transition flex items-center gap-2"
                  >
                    <FileText size={16} />
                    <span>Materiale Grafico</span>
                  </Link>
                )
              ) : null}
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
