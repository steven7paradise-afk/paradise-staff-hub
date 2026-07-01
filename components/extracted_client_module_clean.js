const module_def = {
  20154: (e, t, a) => {
    "use strict";
    a.d(t, { TabletClock: () => H });
    var s = a(95155),
      l = a(12115),
      r = a(78340);
    let c = (0, r.A)("LogIn", [
      [
        "path",
        { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", key: "u53s6r" },
      ],
      ["polyline", { points: "10 17 15 12 10 7", key: "1ail0h" }],
      ["line", { x1: "15", x2: "3", y1: "12", y2: "12", key: "v6grx8" }],
    ]);
    var n = a(72230),
      i = a(91958),
      o = a(41313),
      d = a(71549),
      x = a(33210),
      m = a(44478),
      p = a(41585),
      b = a(24538),
      u = a(24338),
      h = a(74643);
    let f = (0, r.A)("VolumeX", [
      [
        "path",
        {
          d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
          key: "uqj9uw",
        },
      ],
      ["line", { x1: "22", x2: "16", y1: "9", y2: "15", key: "1ewh16" }],
      ["line", { x1: "16", x2: "22", y1: "9", y2: "15", key: "5ykzw1" }],
    ]);
    var g = a(56204),
      k = a(66088),
      j = a(9921),
      N = a(57420),
      v = a(84980),
      y = a(22368),
      w = a(12651),
      A = a(21628),
      C = a(89123),
      S = a(37618),
      z = a(94514),
      T = a(48368),
      E = a(90549);
    let M = (0, r.A)("Coins", [
      ["circle", { cx: "8", cy: "8", r: "6", key: "3yglwk" }],
      ["path", { d: "M18.09 10.37A6 6 0 1 1 10.34 18", key: "t5s6rm" }],
      ["path", { d: "M7 6h1v4", key: "1obek4" }],
      ["path", { d: "m16.71 13.88.7.71-2.82 2.82", key: "1rbuyh" }],
    ]);
    var _ = a(92289),
      I = a(85118),
      F = a(64635),
      D = a(91337),
      P = a(8587),
      O = a(73321);
    let L = [
        { type: "ENTRATA", label: "Entrata", icon: c, dark: !0 },
        { type: "PAUSA", label: "Pausa", icon: n.A, dark: !1 },
        { type: "RIENTRO", label: "Rientro", icon: i.A, dark: !1 },
        { type: "USCITA", label: "Uscita", icon: o.A, dark: !0 },
      ],
      R = { OUT: "Non entrato", IN: "In turno", BREAK: "In pausa" },
      U = {
        OUT: ["ENTRATA"],
        IN: ["PAUSA", "USCITA"],
        BREAK: ["RIENTRO", "USCITA"],
      };
    function $(e) {
      let t = Math.max(0, Math.floor(e)),
        a = Math.floor(t / 3600),
        s = Math.floor((t % 3600) / 60);
      return `${String(a).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    }
    function B({ pin: e }) {
      return (0, s.jsx)("div", {
        className:
          "grid h-16 grid-cols-6 items-center rounded-[22px] border border-[#eadfd6] bg-white/58 px-8 sm:h-20",
        children: Array.from({ length: 6 }, (t, a) =>
          (0, s.jsx)(
            "span",
            {
              className: `mx-auto size-4 rounded-full border-2 ${e.length > a ? "border-[#aa7b47] bg-[#aa7b47]" : "border-[#171717]"}`,
            },
            a,
          ),
        ),
      });
    }
    function q({ onDigit: e, onBackspace: t, onClear: a, disabled: l = !1 }) {
      let r =
        "h-14 rounded-xl border border-[#eadfd6] bg-white/72 text-xl font-semibold shadow-sm transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-55 sm:h-[62px] touch-manipulation";
      return (0, s.jsxs)("div", {
        className: "grid grid-cols-3 gap-1.5",
        children: [
          ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) =>
            (0, s.jsx)(
              "button",
              {
                type: "button",
                disabled: l,
                className: r,
                onClick: () => e(t),
                children: t,
              },
              t,
            ),
          ),
          (0, s.jsx)("button", {
            type: "button",
            disabled: l,
            className: `${r} grid place-items-center`,
            onClick: t,
            children: (0, s.jsx)(d.A, { className: "size-5" }),
          }),
          (0, s.jsx)("button", {
            type: "button",
            disabled: l,
            className: r,
            onClick: () => e("0"),
            children: "0",
          }),
          (0, s.jsx)("button", {
            type: "button",
            disabled: l,
            className: `${r} grid place-items-center`,
            onClick: a,
            children: (0, s.jsx)(x.A, { className: "size-5" }),
          }),
        ],
      });
    }
    function H({
      device: e,
      branding: t,
      tabletBranding: r,
      clientControlFormId: c,
      todayAppointments: d = [],
    }) {
      let V,
        Q,
        G,
        J,
        Z,
        K,
        X,
        W,
        Y,
        ee,
        et,
        ea = (0, O.useRouter)(),
        [es, el] = (0, l.useState)(new Set()),
        er = d.filter((e) => !es.has(e.id)),
        [ec, en] = (0, l.useState)(!0),
        [ei, eo] = (0, l.useState)(!1),
        ed = async () => {
          ei ||
            (eo(!0),
            ea.refresh(),
            setTimeout(() => {
              eo(!1);
            }, 1200));
        },
        [ex, em] = (0, l.useState)(new Date()),
        [ep, eb] = (0, l.useState)(""),
        [eu, eh] = (0, l.useState)(null),
        [ef, eg] = (0, l.useState)([]),
        [ek, ej] = (0, l.useState)(!1),
        [eN, ev] = (0, l.useState)(!1),
        [ey, ew] = (0, l.useState)(null),
        [eA, eC] = (0, l.useState)(!1),
        [eS, ez] = (0, l.useState)(null),
        [eT, eE] = (0, l.useState)(!1),
        [eM, e_] = (0, l.useState)("Tutti"),
        [eI, eF] = (0, l.useState)("analytics"),
        [eD, eP] = (0, l.useState)({
          salon: e?.locationName ?? "",
          clientName: "",
          serviceTitle: "",
          depositPaid: "",
          paid: "",
          staffIds: [],
          shopifyOrder: "",
          instagramTag: "",
          notes: !1,
          beforeMedia: !1,
          afterMedia: !1,
          products: !1,
          review: !1,
        }),
        [eO, eL] = (0, l.useState)(!1),
        [eR, eU] = (0, l.useState)(null),
        [e$, eB] = (0, l.useState)(null),
        [eq, eH] = (0, l.useState)({}),
        [eV, eQ] = (0, l.useState)(null),
        [eG, eJ] = (0, l.useState)(!1),
        [eZ, eK] = (0, l.useState)(!1),
        [eX, eW] = (0, l.useState)(null),
        eY = (0, l.useRef)(null),
        e0 = (0, l.useRef)(null);
      (0, l.useEffect)(() => {
        window.top &&
          window !== window.top &&
          (window.top.location.href = "/tablet-clock");
      }, []);
      let [e1, e2] = (0, l.useState)("Inserisci il tuo codice personale"),
        [e5, e4] = (0, l.useState)(null),
        [e3, e8] = (0, l.useState)(null),
        [e7, e6] = (0, l.useState)(!1),
        e9 = (0, l.useRef)(!1),
        [te, tt] = (0, l.useState)(!0),
        ta = (0, l.useRef)(null),
        [ts, tl] = (0, l.useState)(!1),
        [tr, tc] = (0, l.useState)("FERIE"),
        [tn, ti] = (0, l.useState)("2026-06-10"),
        [to, td] = (0, l.useState)("2026-06-10"),
        [tx, tm] = (0, l.useState)(""),
        [tp, tb] = (0, l.useState)(""),
        [tu, th] = (0, l.useState)(""),
        [tf, tg] = (0, l.useState)(""),
        [tk, tj] = (0, l.useState)(""),
        [tN, tv] = (0, l.useState)(
          "Il PIN gia inserito conferma questa richiesta come firma.",
        ),
        ty = eu ? L.filter((e) => U[eu.status].includes(e.type)) : [],
        tw =
          ((V = [...ef].sort(
            (e, t) =>
              new Date(e.timestamp).getTime() - new Date(t.timestamp).getTime(),
          )),
          (Q = null),
          (G = null),
          (J = 0),
          (Z = 0),
          (K = ""),
          (X = ""),
          V.forEach((e) => {
            let t = new Date(e.timestamp).getTime();
            (("ENTRATA" === e.type || "RIENTRO" === e.type) &&
              ((Q = t), (G = null), (K = e.time)),
              "PAUSA" === e.type &&
                (null !== Q && (J += Math.max(0, t - Q)),
                (Q = null),
                (G = t),
                (X = e.time)),
              "USCITA" === e.type &&
                (null !== Q && (J += Math.max(0, t - Q)),
                null !== G && (Z += Math.max(0, t - G)),
                (Q = null),
                (G = null)));
          }),
          null !== Q && (J += Math.max(0, ex.getTime() - Q)),
          null !== G && (Z += Math.max(0, ex.getTime() - G)),
          {
            workSeconds: Math.floor(J / 1e3),
            breakSeconds: Math.floor(Z / 1e3),
            lastEntryTime: K,
            lastPauseTime: X,
          }),
        tA = 60 * ex.getHours() + ex.getMinutes(),
        tC = (function (e) {
          if (!e) return null;
          let [t, a] = e.split(":"),
            s = Number(t),
            l = Number(a);
          return Number.isFinite(s) && Number.isFinite(l) ? 60 * s + l : null;
        })(eu?.todayShift?.endTime),
        tS = null === tC ? 0 : Math.max(0, tC - tA),
        tz = !!(eu && "OUT" !== eu.status && null !== tC && tS > 0),
        tT = eS?.salons ?? [],
        tE = (0, l.useMemo)(() => {
          let t = new Set();
          return (
            e?.locationName && t.add(e.locationName),
            eS?.salons.forEach((e) => t.add(e.salon)),
            eS?.employees?.forEach((e) => {
              e.locationName &&
                "Senza sede" !== e.locationName &&
                t.add(e.locationName);
            }),
            Array.from(t).sort((e, t) => e.localeCompare(t))
          );
        }, [eS, e?.locationName]),
        tM = (0, l.useMemo)(() => {
          let e = eD.salon,
            t = (e) =>
              String(e ?? "")
                .toLowerCase()
                .replace(/^salone\s+/, "")
                .replace(/^corso\s+/, "")
                .replace(/\s+/g, " ")
                .trim();
          return (eS?.employees ?? []).filter(
            (a) => t(a.locationName) === t(e),
          );
        }, [eD.salon, eS?.employees]),
        t_ = (0, l.useMemo)(() => {
          if (!tT.length) return null;
          if ("Tutti" === eM) {
            let e = new Map();
            return (
              tT.forEach((t) => {
                t.staff.forEach((t) => {
                  let a = e.get(t.name) ?? {
                    name: t.name,
                    services: 0,
                    notePhoto: 0,
                    products: 0,
                    reviews: 0,
                    checks: 0,
                  };
                  ((a.services += t.services),
                    (a.notePhoto += t.notePhoto),
                    (a.products += t.products),
                    (a.reviews += t.reviews),
                    (a.checks += t.checks),
                    e.set(t.name, a));
                });
              }),
              {
                salon: "Tutti i saloni",
                responses: tT.reduce((e, t) => e + t.responses, 0),
                staff: Array.from(e.values()).sort(
                  (e, t) =>
                    t.services - e.services ||
                    t.checks - e.checks ||
                    e.name.localeCompare(t.name),
                ),
              }
            );
          }
          return tT.find((e) => e.salon === eM) ?? tT[0];
        }, [eM, tT]),
        tI = {
          "--tablet-bg":
            r?.background_color || t?.background_color || "#fbf7f2",
          "--tablet-card": r?.card_color || t?.card_color || "#ffffff",
          "--tablet-text": r?.text_color || t?.text_color || "#171717",
          "--tablet-accent": r?.accent_color || t?.gradient_color || "#a77a49",
          "--tablet-soft": r?.soft_color || t?.secondary_color || "#f8ddd7",
          "--tablet-dark": r?.button_color || t?.text_color || "#1c1c1c",
        };
      function tF() {
        (eE(!0),
          fetch("/api/client-control/analytics", { cache: "no-store" })
            .then((e) => (e.ok ? e.json() : null))
            .then((t) => {
              (ez(t), e_("Tutti"));
              let a =
                e?.locationName ||
                t?.salons?.[0]?.salon ||
                t?.employees?.[0]?.locationName ||
                "";
              eP((e) => ({ ...e, salon: e.salon || a }));
            })
            .catch(() => ez(null))
            .finally(() => eE(!1)));
      }
      async function tD(e) {
        eQ(e);
        try {
          let t = await fetch(`/api/service-forms/responses/${e}`, {
              cache: "no-store",
            }),
            a = await t.json().catch(() => null);
          if (!t.ok || !a)
            throw Error(a?.error || "Non riesco ad aprire questa scheda.");
          (eB(a), eH(a.answers ?? {}));
        } catch (e) {
          (eU({
            type: "error",
            text:
              e instanceof Error
                ? e.message
                : "Non riesco ad aprire questa scheda.",
          }),
            tL("error"));
        } finally {
          eQ(null);
        }
      }
      async function tP() {
        if (e$) {
          eJ(!0);
          try {
            let e = await fetch(`/api/service-forms/responses/${e$.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers: eq }),
              }),
              t = await e.json().catch(() => null);
            if (!e.ok || !t)
              throw Error(t?.error || "Errore durante il salvataggio.");
            (eB(t),
              eH(t.answers ?? {}),
              eU({
                type: "success",
                text: "Scheda cliente aggiornata correttamente.",
              }),
              tF(),
              tL("success"));
          } catch (e) {
            (eU({
              type: "error",
              text:
                e instanceof Error
                  ? e.message
                  : "Errore durante il salvataggio.",
            }),
              tL("error"));
          } finally {
            eJ(!1);
          }
        }
      }
      async function tO() {
        if (
          (eU(null),
          !eD.salon ||
            !eD.clientName.trim() ||
            !eD.shopifyOrder.trim() ||
            0 === eD.staffIds.length)
        ) {
          (eU({
            type: "error",
            text: "Completa tutti i campi obbligatori: sede, nome cliente, ordine Shopify e collaboratore.",
          }),
            tL("error"));
          return;
        }
        eL(!0);
        try {
          let e = await fetch("/api/client-control/tablet-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(eD),
            }),
            t = await e.json().catch(() => ({}));
          if (!e.ok) throw Error(t?.error || "Errore durante il salvataggio.");
          (eU({
            type: "success",
            text: "Appuntamento salvato. Lo trovi nella cronologia Controllo Cliente.",
          }),
            eP((e) => ({
              ...e,
              clientName: "",
              serviceTitle: "",
              depositPaid: "",
              paid: "",
              staffIds: [],
              shopifyOrder: "",
              instagramTag: "",
              notes: !1,
              beforeMedia: !1,
              afterMedia: !1,
              products: !1,
              review: !1,
            })),
            tF(),
            tL("success"));
        } catch (e) {
          (eU({
            type: "error",
            text:
              e instanceof Error ? e.message : "Errore durante il salvataggio.",
          }),
            tL("error"));
        } finally {
          eL(!1);
        }
      }
      function tL(e, t = !1) {
        if (!te && !t) return;
        let a = window.AudioContext ?? window.webkitAudioContext;
        if (!a) return;
        let s = ta.current ?? new a();
        ta.current = s;
        let l = () => {
          ("tap" === e
            ? [[620, 0, 0.055, "sine", 0.35]]
            : "success" === e
              ? [
                  [523, 0, 0.14, "sine", 0.75],
                  [659, 0.13, 0.18, "sine", 0.85],
                  [880, 0.32, 0.24, "triangle", 0.95],
                ]
              : [
                  [260, 0, 0.18, "triangle", 0.9],
                  [196, 0.19, 0.22, "sine", 0.95],
                ]
          ).forEach(([e, t, a, l, r]) => {
            let c = s.createOscillator(),
              n = s.createGain(),
              i = s.createBiquadFilter();
            ((c.type = l),
              (c.frequency.value = e),
              (i.type = "lowpass"),
              (i.frequency.value = 3200),
              n.gain.setValueAtTime(1e-4, s.currentTime + t),
              n.gain.exponentialRampToValueAtTime(r, s.currentTime + t + 0.02),
              n.gain.exponentialRampToValueAtTime(1e-4, s.currentTime + t + a),
              c.connect(i).connect(n).connect(s.destination),
              c.start(s.currentTime + t),
              c.stop(s.currentTime + t + a + 0.03));
          });
        };
        "suspended" === s.state ? s.resume().then(l) : l();
      }
      function tR(e, t) {
        (e4({ type: e, text: t }),
          "success" === e && navigator.vibrate?.([70, 35, 70]),
          "error" === e && navigator.vibrate?.([180, 60, 180, 60, 180]));
      }
      async function tU(t = ep) {
        if (!/^\d{4,6}$/.test(t) || !e || e9.current) return;
        ((e9.current = !0), e6(!0));
        let a = new AbortController(),
          s = window.setTimeout(() => a.abort(), 3e3);
        try {
          e2("Riconoscimento in corso...");
          let s = await fetch("/api/attendance/identify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-device-id": e.id,
              },
              body: JSON.stringify({ pin: t }),
              signal: a.signal,
            }),
            l = await s.json();
          if (!s.ok) {
            (eh(null),
              eb(""),
              e2("PIN errato. Reinserisci il codice."),
              tR("error", l.error ?? "Codice personale non riconosciuto."),
              tL("error"));
            return;
          }
          (eh({
            id: l.employeeId,
            name: l.employeeName,
            status: l.status,
            photoUrl: l.employeePhotoUrl,
            role: l.employeeRole,
            mansione: l.employeeMansione,
            todayShift: l.todayShift ?? null,
          }),
            eg(Array.isArray(l.todayLogs) ? l.todayLogs : []),
            e2(`${l.employeeName}: ${R[l.status]}`),
            tR("success", `${l.employeeName} riconosciuta. Scegli l'azione.`),
            tL("success"));
        } catch (t) {
          let e = t instanceof DOMException && "AbortError" === t.name;
          (eb(""),
            e2(
              e
                ? "Lettura lenta. Riprova il PIN."
                : "Impossibile verificare il codice.",
            ),
            tR(
              "error",
              e
                ? "Lettura oltre 3 secondi. Riprova."
                : "Impossibile verificare il codice.",
            ),
            tL("error"));
        } finally {
          (window.clearTimeout(s), (e9.current = !1), e6(!1));
        }
      }
      function t$(e) {
        let t = e.replace(/\D/g, "").slice(0, 6);
        e9.current ||
          (t !== ep && tL("tap"),
          eb(t),
          eh(null),
          e4(null),
          e2(
            t.length < 4
              ? "Inserisci il tuo codice personale"
              : 6 === t.length
                ? "Riconoscimento automatico..."
                : "Premi Invia PIN per continuare",
          ));
      }
      async function tB(t, a = !1) {
        if (eu && /^\d{4,6}$/.test(ep) && e) {
          if ("USCITA" === t && tz && !a) {
            (eW("clock"), eK(!0));
            return;
          }
          e8(t);
          try {
            var s;
            let a = await fetch("/api/attendance/clock", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-device-id": e.id,
                },
                body: JSON.stringify({
                  employeeId: eu.id,
                  pin: ep,
                  type: t,
                  note: "Timbratura tablet",
                }),
              }),
              l = await a.json();
            if (!a.ok) {
              (e2(l.error ?? "Timbratura non registrata."),
                tR("error", l.error ?? "Timbratura non registrata."),
                tL("error"));
              return;
            }
            (eg((e) => [
              ...e,
              {
                id: l.id,
                type: l.type,
                timestamp: l.timestamp ?? new Date().toISOString(),
                time: l.time,
              },
            ]),
              (s = `${t} registrata alle ${l.time}${l.adjusted ? ` (ora rilevata ${l.actualTime})` : ""}.`),
              tL("success"),
              tR("success", s),
              e2(s),
              eh(null),
              eb(""));
          } catch {
            (e2("Connessione non disponibile. Timbratura non registrata."),
              tR(
                "error",
                "Connessione non disponibile. Timbratura non registrata.",
              ),
              tL("error"));
          } finally {
            e8(null);
          }
        }
      }
      async function tq() {
        if (eu && /^\d{4,6}$/.test(ep) && e) {
          e8("DASHBOARD");
          try {
            let e = await (0, P.Jv)("credentials", { pin: ep, redirect: !1 });
            if (e?.error) {
              (tR("error", "Impossibile accedere alla dashboard."),
                tL("error"));
              return;
            }
            (tL("success"), eC(!0), ej(!0));
          } catch {
            (tR("error", "Errore durante l'accesso."), tL("error"));
          } finally {
            e8(null);
          }
        }
      }
      async function tH(t = "analytics") {
        if (e && c) {
          e8("CLIENT_CONTROL");
          try {
            (tL("success"), eC(!1), eF(t), eU(null), ev(!0), tF());
          } catch {
            (tR("error", "Errore durante l'apertura del controllo cliente."),
              tL("error"));
          } finally {
            e8(null);
          }
        }
      }
      async function tV(t) {
        if (e && c) {
          e8("CLIENT_CONTROL");
          try {
            (tL("success"), eC(!1), eF("create"), eU(null));
            let a = eS?.employees,
              s = eS;
            if (!s) {
              let e = await fetch("/api/client-control/analytics", {
                cache: "no-store",
              });
              e.ok &&
                ((s = await e.json()), ez(s), (a = s?.employees), e_("Tutti"));
            }
            let l =
                tE.find((e) => {
                  let a = e.toLowerCase();
                  return "duomo" === t.inferredSalon
                    ? a.includes("duomo")
                    : "buenos-aires" === t.inferredSalon
                      ? a.includes("buenos")
                      : "ufficio" === t.inferredSalon && a.includes("ufficio");
                }) ||
                e?.locationName ||
                tE[0] ||
                "",
              r = [];
            if (t.teammates && t.teammates.length > 0 && a) {
              let e = (e) => e.toLowerCase().replace(/[^a-z0-9]/g, "");
              for (let s of t.teammates) {
                let t = e(s.name),
                  l = a.find((a) => {
                    let s = e(a.name);
                    return s.includes(t) || t.includes(s);
                  });
                l && r.push(l.id);
              }
            }
            (eP({
              salon: l,
              clientName: t.customerName || "",
              serviceTitle: t.serviceTitle || "",
              depositPaid: null != t.priceAmount ? String(t.priceAmount) : "",
              paid: "",
              staffIds: r,
              shopifyOrder: t.isManual
                ? ""
                : t.bookingStr
                  ? t.bookingStr.replace(/^#/, "")
                  : "",
              instagramTag: "",
              notes: !1,
              beforeMedia: !1,
              afterMedia: !1,
              products: !1,
              review: !1,
            }),
              ev(!0));
          } catch (e) {
            (console.error("Error pre-filling booking:", e),
              tR("error", "Errore durante l'apertura del controllo cliente."),
              tL("error"));
          } finally {
            e8(null);
          }
        }
      }
      async function tQ(t = !1) {
        e8(t ? "FINAL_SHIFT" : "LOGOUT");
        try {
          if (t && eu && "OUT" !== eu.status && /^\d{4,6}$/.test(ep) && e) {
            let t = await fetch("/api/attendance/clock", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-device-id": e.id,
                },
                body: JSON.stringify({
                  employeeId: eu.id,
                  pin: ep,
                  type: "USCITA",
                  note: "Fine turno da dashboard tablet",
                }),
              }),
              a = await t.json().catch(() => ({}));
            if (!t.ok && 409 !== t.status) {
              (tR("error", a.error ?? "Fine turno non registrata."),
                e2(a.error ?? "Fine turno non registrata."),
                tL("error"));
              return;
            }
            t.ok &&
              (eg((e) => [
                ...e,
                {
                  id: a.id,
                  type: a.type,
                  timestamp: a.timestamp ?? new Date().toISOString(),
                  time: a.time,
                },
              ]),
              tL("success"));
          }
          let { signOut: s } = await Promise.resolve().then(a.bind(a, 8587));
          (await s({ redirect: !1 }),
            eh(null),
            eg([]),
            eb(""),
            e4(null),
            e2("Inserisci il tuo codice personale"),
            ej(!1),
            ev(!1),
            eK(!1),
            eW(null));
        } catch (e) {
          console.error("Errore durante il logout:", e);
        } finally {
          e8(null);
        }
      }
      if (
        ((0, l.useEffect)(() => {
          let e = window.setInterval(() => em(new Date()), 1e3);
          return () => window.clearInterval(e);
        }, []),
        (0, l.useEffect)(() => {
          tt("off" !== window.localStorage.getItem("paradise-tablet-sound"));
        }, []),
        (0, l.useEffect)(() => {
          if (!eu && !ts)
            return (
              window.addEventListener("keydown", e),
              () => window.removeEventListener("keydown", e)
            );
          function e(e) {
            let t = e.target;
            "INPUT" !== t.tagName &&
              "SELECT" !== t.tagName &&
              "TEXTAREA" !== t.tagName &&
              !t.isContentEditable &&
              (e.key >= "0" && e.key <= "9"
                ? (e.preventDefault(), ep.length < 6 && t$(ep + e.key))
                : "Backspace" === e.key
                  ? (e.preventDefault(), t$(ep.slice(0, -1)))
                  : "Escape" === e.key
                    ? (e.preventDefault(), t$(""))
                    : "Enter" === e.key &&
                      (e.preventDefault(), /^\d{4,6}$/.test(ep) && tU(ep)));
          }
        }, [eu, ts, ep, e, e7]),
        (0, l.useEffect)(() => {
          if (6 !== ep.length || !e || e9.current) return;
          let t = window.setTimeout(() => void tU(ep), 120);
          return () => window.clearTimeout(t);
        }, [ep, e]),
        (0, l.useEffect)(() => {
          if (!eu || ts) return;
          let e = window.setTimeout(() => {
            (eh(null),
              eg([]),
              eb(""),
              e2("Inserisci il tuo codice personale"),
              e4(null));
          }, 3e4);
          return () => window.clearTimeout(e);
        }, [eu, ts]),
        (0, l.useEffect)(() => {
          if (!ek && !eN) return;
          let e = () => {
              (e0.current && window.clearTimeout(e0.current),
                (e0.current = window.setTimeout(() => {
                  tQ();
                }, 6e4)));
            },
            t = ["pointerdown", "touchstart", "keydown", "wheel"];
          (t.forEach((t) => window.addEventListener(t, e, { passive: !0 })),
            e());
          let a = eY.current?.contentWindow,
            s = eY.current?.contentDocument;
          return (
            t.forEach((t) => {
              (a?.addEventListener(t, e, { passive: !0 }),
                s?.addEventListener(t, e, { passive: !0 }));
            }),
            () => {
              (e0.current && window.clearTimeout(e0.current),
                t.forEach((t) => window.removeEventListener(t, e)),
                t.forEach((t) => {
                  (a?.removeEventListener(t, e), s?.removeEventListener(t, e));
                }));
            }
          );
        }, [ek, eN]),
        !e)
      )
        return (0, s.jsx)("main", {
          className:
            "grid min-h-screen place-items-center bg-[color:var(--tablet-bg)] p-5 text-[color:var(--tablet-text)]",
          style: tI,
          children: (0, s.jsxs)("div", {
            className:
              "rounded-[28px] border border-[#eadfd6] bg-white/80 px-10 py-12 text-center shadow-lg",
            children: [
              (0, s.jsx)(m.A, { className: "mx-auto size-12 text-red-500" }),
              (0, s.jsx)("p", {
                className: "mt-5 text-xl font-semibold",
                children: "Dispositivo non autorizzato alla timbratura",
              }),
            ],
          }),
        });
      function tG({ action: e }) {
        let t = e.icon;
        return (0, s.jsxs)("button", {
          className: `flex min-h-20 md:min-h-28 landscape:min-h-[105px] lg:min-h-[130px] flex-col items-center justify-center rounded-2xl border border-black/10 px-4 shadow-[0_12px_36px_rgba(0,0,0,0.10)] active:scale-[0.99] ${e.dark ? "bg-[color:var(--tablet-dark)] text-white" : "bg-[color:var(--tablet-card)]/72"}`,
          disabled: null !== e3,
          onClick: () => tB(e.type),
          children: [
            (0, s.jsx)(t, {
              className:
                "size-7 md:size-9 landscape:size-8 lg:size-12 text-[color:var(--tablet-accent)]",
              strokeWidth: 1.4,
            }),
            (0, s.jsx)("p", {
              className:
                "mt-2 text-xs md:text-sm uppercase tracking-[0.25em] landscape:mt-3 lg:text-base",
              children: e3 === e.type ? "Invio" : e.label,
            }),
          ],
        });
      }
      function tJ({ compact: e = !1 }) {
        let a = r?.logo_url || t?.logo_url || null;
        return (0, s.jsxs)("div", {
          className: "text-center",
          children: [
            (0, s.jsx)("div", {
              className: `mx-auto grid place-items-center overflow-hidden ${e ? "size-16 lg:size-20" : "size-36 lg:size-44"}`,
              children: a
                ? (0, s.jsx)("img", {
                    src: a,
                    alt: "Paradise Beauty",
                    className: "size-full object-contain",
                  })
                : (0, s.jsx)("p", {
                    className: `${e ? "text-5xl" : "text-[140px]"} font-serif italic leading-none text-[color:var(--tablet-accent)]`,
                    children: "P",
                  }),
            }),
            (0, s.jsx)("p", {
              className: `font-serif leading-none tracking-tight ${e ? "mt-1 text-5xl lg:text-6xl" : "mt-2 text-7xl lg:text-[112px]"}`,
              children: new Intl.DateTimeFormat("it-IT", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(ex),
            }),
            (0, s.jsx)("p", {
              className: `${e ? "mt-1 text-xs" : "mt-2 text-base lg:text-lg"} text-black/62`,
              children: new Intl.DateTimeFormat("it-IT", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              }).format(ex),
            }),
          ],
        });
      }
      let tZ =
        eZ && !ek
          ? (0, s.jsx)("div", {
              className:
                "absolute inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm",
              children: (0, s.jsxs)("div", {
                className:
                  "w-full max-w-xl rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex items-start gap-4",
                    children: [
                      (0, s.jsx)("div", {
                        className:
                          "grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600",
                        children: (0, s.jsx)(p.A, { className: "size-6" }),
                      }),
                      (0, s.jsxs)("div", {
                        className: "min-w-0",
                        children: [
                          (0, s.jsx)("p", {
                            className:
                              "text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]",
                            children: "Conferma uscita",
                          }),
                          (0, s.jsx)("h3", {
                            className:
                              "mt-1 text-2xl font-black text-[#171717]",
                            children: "Manca ancora tempo al turno",
                          }),
                          (0, s.jsxs)("p", {
                            className:
                              "mt-2 text-sm font-semibold leading-6 text-black/60",
                            children: [
                              "A ",
                              eu?.name,
                              " mancano ancora",
                              " ",
                              (0, s.jsx)("span", {
                                className: "font-black text-[#171717]",
                                children: $(60 * tS),
                              }),
                              " ",
                              "per completare il turno previsto",
                              eu?.todayShift?.endTime
                                ? (0, s.jsxs)(s.Fragment, {
                                    children: [
                                      " ",
                                      "fino alle ",
                                      (0, s.jsx)("span", {
                                        className: "font-black text-[#171717]",
                                        children: eu.todayShift.endTime.slice(
                                          0,
                                          5,
                                        ),
                                      }),
                                    ],
                                  })
                                : null,
                              ".",
                            ],
                          }),
                          eu?.todayShift?.startTime ||
                          eu?.todayShift?.plannedHours
                            ? (0, s.jsxs)("p", {
                                className:
                                  "mt-2 text-xs font-bold text-black/45",
                                children: [
                                  "Turno previsto: ",
                                  eu.todayShift?.startTime?.slice(0, 5) ??
                                    "--:--",
                                  " - ",
                                  eu.todayShift?.endTime?.slice(0, 5) ??
                                    "--:--",
                                  " \xb7 ",
                                  (function (e) {
                                    if (!Number.isFinite(e) || e <= 0)
                                      return "0h";
                                    let t = Math.floor(e),
                                      a = Math.round((e - t) * 60);
                                    return 0 === a ? `${t}h` : `${t}h ${a}m`;
                                  })(eu.todayShift?.plannedHours ?? 0),
                                ],
                              })
                            : null,
                          (0, s.jsx)("p", {
                            className:
                              "mt-3 text-sm font-semibold text-black/70",
                            children:
                              "Sei sicura di voler timbrare l'uscita adesso?",
                          }),
                        ],
                      }),
                    ],
                  }),
                  (0, s.jsxs)("div", {
                    className:
                      "mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end",
                    children: [
                      (0, s.jsx)("button", {
                        type: "button",
                        onClick: () => eK(!1),
                        className:
                          "rounded-2xl bg-black/[0.05] px-5 py-3 text-sm font-black text-black/65",
                        children: "Annulla",
                      }),
                      (0, s.jsx)("button", {
                        type: "button",
                        onClick: () => {
                          (eK(!1), eW(null), tB("USCITA", !0));
                        },
                        className:
                          "rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20",
                        children: "Conferma uscita",
                      }),
                    ],
                  }),
                ],
              }),
            })
          : null;
      return ek
        ? (0, s.jsx)("main", {
            className:
              "h-[100svh] overflow-hidden bg-[color:var(--tablet-bg)] p-2 text-[color:var(--tablet-text)] sm:p-4",
            style: tI,
            children: (0, s.jsxs)("div", {
              className:
                "relative flex h-[calc(100svh-1rem)] sm:h-[calc(100svh-2rem)] flex-col rounded-[26px] border-[10px] border-black bg-[color:var(--tablet-card)] shadow-[0_20px_70px_rgba(0,0,0,0.2)] xl:border-[16px] overflow-hidden",
              children: [
                (0, s.jsxs)("div", {
                  className:
                    "flex items-center justify-between border-b border-black/10 px-6 py-4 bg-[color:var(--tablet-card)] shadow-sm",
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex items-center gap-3",
                      children: [
                        eu?.photoUrl
                          ? (0, s.jsx)("div", {
                              className:
                                "relative size-10 overflow-hidden rounded-full border-2 border-[color:var(--tablet-accent)] shadow-sm",
                              children: (0, s.jsx)("img", {
                                src: eu.photoUrl,
                                alt: "",
                                className: "size-full object-cover",
                              }),
                            })
                          : (0, s.jsx)("div", {
                              className:
                                "flex size-10 items-center justify-center rounded-full border-2 border-[color:var(--tablet-accent)] bg-[color:var(--tablet-soft)] text-sm font-black uppercase tracking-wider text-[color:var(--tablet-accent)] shadow-sm",
                              children: eu?.name
                                .split(" ")
                                .map((e) => e[0])
                                .join("")
                                .slice(0, 2),
                            }),
                        (0, s.jsxs)("div", {
                          children: [
                            (0, s.jsx)("p", {
                              className:
                                "text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--tablet-accent)]",
                              children: "Area Riservata",
                            }),
                            (0, s.jsx)("p", {
                              className:
                                "text-sm font-bold tracking-tight text-[color:var(--tablet-text)]",
                              children: eu?.name,
                            }),
                          ],
                        }),
                      ],
                    }),
                    (0, s.jsxs)("button", {
                      className:
                        "flex h-11 items-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-bold uppercase tracking-[0.15em] text-white shadow-md shadow-red-600/10 hover:bg-red-700 active:scale-[0.98] transition-all duration-200",
                      onClick: () => {
                        tQ(!0);
                      },
                      disabled: "LOGOUT" === e3 || "FINAL_SHIFT" === e3,
                      children: [
                        (0, s.jsx)(o.A, { className: "size-4" }),
                        " ",
                        (0, s.jsx)("span", {
                          children:
                            "FINAL_SHIFT" === e3
                              ? "Fine turno..."
                              : "LOGOUT" === e3
                                ? "Uscita..."
                                : "Esci",
                        }),
                      ],
                    }),
                  ],
                }),
                (0, s.jsxs)("div", {
                  className: "flex-1 w-full bg-[#fbf7f2] relative",
                  children: [
                    eA &&
                      (0, s.jsx)("div", {
                        className:
                          "absolute inset-0 flex items-center justify-center bg-[#fbf7f2] z-50",
                        children: (0, s.jsxs)("div", {
                          className: "text-center",
                          children: [
                            (0, s.jsx)("div", {
                              className:
                                "mx-auto size-12 border-4 border-[color:var(--tablet-accent)] border-t-transparent rounded-full animate-spin",
                            }),
                            (0, s.jsx)("p", {
                              className:
                                "mt-4 text-sm font-semibold text-black/60 uppercase tracking-widest",
                              children: "Caricamento Dashboard...",
                            }),
                          ],
                        }),
                      }),
                    (0, s.jsx)("iframe", {
                      id: "kiosk-dashboard-iframe",
                      ref: eY,
                      title: "Profilo privato",
                      src: "/dashboard",
                      className: "size-full border-0",
                      onLoad: () => eC(!1),
                    }),
                  ],
                }),
              ],
            }),
          })
        : (0, s.jsx)("main", {
            className:
              "h-[100svh] overflow-hidden bg-[color:var(--tablet-bg)] p-2 text-[color:var(--tablet-text)] sm:p-4",
            style: tI,
            children: (0, s.jsxs)("div", {
              className:
                "relative flex h-[calc(100svh-1rem)] sm:h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-[26px] border-[10px] border-black bg-[color:var(--tablet-card)] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.2)] sm:px-7 sm:py-6 xl:border-[16px]",
              children: [
                (0, s.jsxs)("header", {
                  className:
                    "relative z-10 flex items-start justify-between gap-3",
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex items-center gap-2 sm:gap-3",
                      children: [
                        (0, s.jsx)("div", {
                          className:
                            "grid size-10 place-items-center rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/70",
                          children: (0, s.jsx)(b.A, {
                            className:
                              "size-4 text-[color:var(--tablet-accent)]",
                          }),
                        }),
                        (0, s.jsxs)("div", {
                          children: [
                            (0, s.jsx)("p", {
                              className:
                                "text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm",
                              children: e.locationName,
                            }),
                            (0, s.jsx)("p", {
                              className: "text-xs text-black/60 sm:text-sm",
                              children: e.name,
                            }),
                          ],
                        }),
                      ],
                    }),
                    (0, s.jsxs)("div", {
                      className: "flex items-center gap-2",
                      children: [
                        c
                          ? (0, s.jsxs)("button", {
                              type: "button",
                              "aria-label": "Appuntamenti",
                              className:
                                "flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 text-xs font-bold uppercase text-[color:var(--tablet-accent)]",
                              onClick: () => void tH("create"),
                              disabled: "CLIENT_CONTROL" === e3,
                              children: [
                                (0, s.jsx)(u.A, { className: "size-5" }),
                                " ",
                                (0, s.jsx)("span", {
                                  className: "hidden sm:inline",
                                  children:
                                    "CLIENT_CONTROL" === e3
                                      ? "Apro..."
                                      : "Crea appuntamenti",
                                }),
                              ],
                            })
                          : null,
                        (0, s.jsxs)("button", {
                          "aria-label": te
                            ? "Suono attivo"
                            : "Suono disattivato",
                          className:
                            "flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 text-xs font-bold uppercase text-[color:var(--tablet-accent)]",
                          onClick: () => {
                            let e = !te;
                            (tt(e),
                              window.localStorage.setItem(
                                "paradise-tablet-sound",
                                e ? "on" : "off",
                              ),
                              e && tL("success", !0));
                          },
                          children: [
                            te
                              ? (0, s.jsx)(h.A, { className: "size-5" })
                              : (0, s.jsx)(f, { className: "size-5" }),
                            (0, s.jsx)("span", {
                              className: "hidden sm:inline",
                              children: te ? "Suono" : "Muto",
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className:
                            "flex items-center gap-1 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 py-2 text-xs font-bold uppercase text-emerald-600 sm:text-sm",
                          children: [
                            (0, s.jsx)(m.A, { className: "size-4" }),
                            " Autorizzato",
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                eu
                  ? (0, s.jsxs)("section", {
                      className:
                        "relative z-10 mx-auto grid min-h-0 w-full max-w-[1250px] flex-1 items-center gap-4 overflow-hidden py-2 md:grid-cols-[minmax(320px,1fr)_300px] landscape:grid-cols-[minmax(320px,1fr)_300px] lg:grid-cols-[minmax(460px,1fr)_340px]",
                      children: [
                        (0, s.jsxs)("div", {
                          className: "grid min-h-0 grid-cols-2 gap-3",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "col-span-2 grid gap-3 sm:grid-cols-2",
                              children: [
                                (0, s.jsxs)("div", {
                                  className:
                                    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm",
                                  children: [
                                    (0, s.jsxs)("div", {
                                      className:
                                        "flex items-center justify-between gap-3",
                                      children: [
                                        (0, s.jsx)("p", {
                                          className:
                                            "text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700",
                                          children: "Tempo in turno",
                                        }),
                                        (0, s.jsx)(v.A, {
                                          className: "size-5",
                                        }),
                                      ],
                                    }),
                                    (0, s.jsx)("p", {
                                      className:
                                        "mt-1 text-2xl font-black tabular-nums lg:text-3xl",
                                      children: $(tw.workSeconds),
                                    }),
                                    (0, s.jsx)("p", {
                                      className:
                                        "mt-1 text-xs font-semibold text-emerald-700",
                                      children: tw.lastEntryTime
                                        ? `Ultima entrata/rientro ${tw.lastEntryTime}`
                                        : "Nessuna entrata oggi",
                                    }),
                                  ],
                                }),
                                (0, s.jsxs)("div", {
                                  className:
                                    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm",
                                  children: [
                                    (0, s.jsxs)("div", {
                                      className:
                                        "flex items-center justify-between gap-3",
                                      children: [
                                        (0, s.jsx)("p", {
                                          className:
                                            "text-[10px] font-black uppercase tracking-[0.2em] text-amber-700",
                                          children: "Pausa oggi",
                                        }),
                                        (0, s.jsx)(n.A, {
                                          className: "size-5",
                                        }),
                                      ],
                                    }),
                                    (0, s.jsx)("p", {
                                      className:
                                        "mt-1 text-2xl font-black tabular-nums lg:text-3xl",
                                      children: $(tw.breakSeconds),
                                    }),
                                    (0, s.jsx)("p", {
                                      className:
                                        "mt-1 text-xs font-semibold text-amber-700",
                                      children: tw.lastPauseTime
                                        ? `Ultima pausa ${tw.lastPauseTime}`
                                        : "Nessuna pausa timbrata",
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            ty.map((e) =>
                              (0, s.jsx)(tG, { action: e }, e.type),
                            ),
                            (0, s.jsxs)("div", {
                              className:
                                "col-span-2 flex min-h-16 md:min-h-20 items-center justify-between rounded-2xl border border-black/10 bg-[color:var(--tablet-card)]/58 px-6",
                              children: [
                                (0, s.jsx)("p", {
                                  className:
                                    "text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--tablet-accent)]",
                                  children: "Stato turno",
                                }),
                                (0, s.jsx)("p", {
                                  className:
                                    "text-base md:text-xl font-semibold",
                                  children: R[eu.status],
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className: "flex min-h-0 flex-col justify-center",
                          children: [
                            (0, s.jsx)(tJ, { compact: !0 }),
                            e5
                              ? (0, s.jsxs)("div", {
                                  className: `mt-3 flex min-h-10 items-center justify-center gap-3 rounded-2xl border px-3 text-xs font-bold shadow-sm ${"success" === e5.type ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`,
                                  children: [
                                    "success" === e5.type
                                      ? (0, s.jsx)(w.A, { className: "size-5" })
                                      : (0, s.jsx)(p.A, {
                                          className: "size-5",
                                        }),
                                    (0, s.jsx)("span", { children: e5.text }),
                                  ],
                                })
                              : null,
                            (0, s.jsx)("div", {
                              className: "mt-3 flex flex-col items-center",
                              children: eu.photoUrl
                                ? (0, s.jsx)("div", {
                                    className:
                                      "relative size-16 overflow-hidden rounded-full border-4 border-[color:var(--tablet-accent)] shadow-md lg:size-20",
                                    children: (0, s.jsx)("img", {
                                      src: eu.photoUrl,
                                      alt: eu.name,
                                      className: "size-full object-cover",
                                    }),
                                  })
                                : (0, s.jsx)("div", {
                                    className:
                                      "flex size-16 items-center justify-center rounded-full border-4 border-[color:var(--tablet-accent)] bg-[color:var(--tablet-soft)] text-xl font-black uppercase tracking-wider text-[color:var(--tablet-accent)] shadow-md lg:size-20",
                                    children: eu.name
                                      .split(" ")
                                      .map((e) => e[0])
                                      .join("")
                                      .slice(0, 2),
                                  }),
                            }),
                            (0, s.jsx)("p", {
                              className:
                                "mt-2 truncate text-center text-base font-semibold",
                              children: eu.name,
                            }),
                            (0, s.jsxs)("button", {
                              className:
                                "mt-2 flex h-12 w-full items-center justify-between rounded-2xl bg-[color:var(--tablet-soft)] px-4 text-left shadow-sm transition-transform duration-200 active:scale-[0.98]",
                              onClick: tq,
                              disabled: null !== e3,
                              children: [
                                (0, s.jsxs)("div", {
                                  className: "flex items-center gap-3",
                                  children: [
                                    (0, s.jsx)(y.A, {
                                      className:
                                        "size-5 text-[color:var(--tablet-accent)]",
                                    }),
                                    (0, s.jsxs)("div", {
                                      children: [
                                        (0, s.jsx)("p", {
                                          className:
                                            "text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--tablet-text)]",
                                          children: "Vedi Dashboard",
                                        }),
                                        (0, s.jsx)("p", {
                                          className:
                                            "text-[11px] text-black/55",
                                          children: "Profilo privato",
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                                (0, s.jsx)(A.A, {
                                  className:
                                    "size-5 text-[color:var(--tablet-accent)]",
                                }),
                              ],
                            }),
                            (0, s.jsx)("button", {
                              className:
                                "mt-2 h-9 w-full rounded-xl border border-black/10 bg-white/60 text-sm font-semibold",
                              onClick: () => {
                                (eh(null),
                                  eb(""),
                                  e4(null),
                                  e2("Inserisci il tuo codice personale"));
                              },
                              children: "Cambia lavoratore",
                            }),
                          ],
                        }),
                      ],
                    })
                  : (0, s.jsxs)("div", {
                      className:
                        "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden py-2",
                      children: [
                        (0, s.jsxs)("div", {
                          className: (0, D.cn)(
                            "mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-6 md:grid-cols-[440px_1fr] landscape:grid-cols-[440px_1fr] transition-all duration-300",
                            ec ? "opacity-90 scale-[0.98] py-1" : "py-4",
                          ),
                          children: [
                            (0, s.jsxs)("div", {
                              className: "mx-auto w-full max-w-[440px]",
                              children: [
                                (0, s.jsx)("p", {
                                  className:
                                    "mb-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--tablet-accent)]",
                                  children: "Codice personale",
                                }),
                                (0, s.jsx)(B, { pin: ep }),
                                (0, s.jsx)("p", {
                                  className:
                                    "my-2 text-center text-sm font-semibold text-black/55",
                                  children: e7
                                    ? "Riconoscimento..."
                                    : 6 === ep.length
                                      ? "Lettura automatica in corso..."
                                      : "Inserisci il PIN e premi Invia.",
                                }),
                                (0, s.jsx)(q, {
                                  onDigit: function (e) {
                                    e9.current ||
                                      eb((t) => {
                                        if (t.length >= 6) return t;
                                        let a = `${t}${e}`.slice(0, 6);
                                        return (
                                          tL("tap"),
                                          eh(null),
                                          e4(null),
                                          e2(
                                            a.length < 4
                                              ? "Inserisci il tuo codice personale"
                                              : 6 === a.length
                                                ? "Riconoscimento automatico..."
                                                : "Premi Invia PIN per continuare",
                                          ),
                                          a
                                        );
                                      });
                                  },
                                  onBackspace: function () {
                                    e9.current || t$(ep.slice(0, -1));
                                  },
                                  onClear: function () {
                                    e9.current || t$("");
                                  },
                                  disabled: e7,
                                }),
                                (0, s.jsxs)("button", {
                                  className:
                                    "mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--tablet-dark)] text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-40",
                                  disabled: !/^\d{4,6}$/.test(ep) || e7,
                                  onClick: () => void tU(),
                                  children: [
                                    (0, s.jsx)(g.A, {
                                      className:
                                        "size-4 text-[color:var(--tablet-accent)]",
                                    }),
                                    " ",
                                    e7 ? "Lettura..." : "Invia PIN",
                                  ],
                                }),
                              ],
                            }),
                            (0, s.jsxs)("div", {
                              className: "hidden md:block landscape:block",
                              children: [
                                (0, s.jsx)(tJ, {}),
                                (0, s.jsx)("div", {
                                  className: "mx-auto mt-5 h-12 max-w-[460px]",
                                  children: e5
                                    ? (0, s.jsxs)("div", {
                                        className: `flex h-12 items-center justify-center gap-3 rounded-2xl border px-4 text-sm font-bold shadow-sm ${"error" === e5.type ? "border-red-200 bg-red-50 text-red-800" : "border-[#eadfd6] bg-white/70 text-black/70"}`,
                                        children: [
                                          "error" === e5.type
                                            ? (0, s.jsx)(p.A, {
                                                className: "size-5",
                                              })
                                            : (0, s.jsx)(m.A, {
                                                className: "size-5",
                                              }),
                                          (0, s.jsx)("span", {
                                            className: "truncate",
                                            children: e5.text,
                                          }),
                                        ],
                                      })
                                    : null,
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className: (0, D.cn)(
                            "relative mt-auto w-full rounded-[24px] border border-[#ff8bb2]/20 bg-white shadow-lg transition-all duration-300 flex flex-col",
                            ec
                              ? "max-h-[50vh] sm:max-h-[42vh]"
                              : "max-h-[52px]",
                          ),
                          children: [
                            (0, s.jsx)("div", {
                              className:
                                "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20",
                              children: (0, s.jsxs)("button", {
                                type: "button",
                                onClick: () => en(!ec),
                                className:
                                  "flex h-7 items-center justify-center gap-1 rounded-full border border-[#ff8bb2]/30 bg-white px-4 text-[10px] font-black uppercase tracking-wider text-[#a74758] shadow-md hover:bg-[#fff2fa] transition-colors",
                                children: [
                                  ec
                                    ? (0, s.jsx)(k.A, { className: "size-3.5" })
                                    : (0, s.jsx)(j.A, {
                                        className: "size-3.5",
                                      }),
                                  ec ? "Riduci" : "Mostra appuntamenti",
                                ],
                              }),
                            }),
                            (0, s.jsxs)("div", {
                              onClick: () => en(!ec),
                              className:
                                "flex h-[52px] cursor-pointer items-center justify-between px-6 border-b border-black/5",
                              children: [
                                (0, s.jsxs)("div", {
                                  className:
                                    "flex items-center gap-2 text-[#E88AC5]",
                                  children: [
                                    (0, s.jsx)(N.A, { className: "size-4.5" }),
                                    (0, s.jsx)("span", {
                                      className:
                                        "text-xs font-black uppercase tracking-[0.18em]",
                                      children:
                                        ((W = er.some((e) => !e.isTomorrow)),
                                        (Y = er.some((e) => e.isTomorrow)),
                                        W && Y
                                          ? "Appuntamenti di oggi e domani"
                                          : Y
                                            ? "Appuntamenti di domani"
                                            : "Appuntamenti di oggi"),
                                    }),
                                    (0, s.jsx)("span", {
                                      className:
                                        "ml-2 rounded-full bg-[#FFF0F2] px-2 py-0.5 text-[10px] font-black text-[#E88AC5] border border-[#FCDCE2]",
                                      children: er.length,
                                    }),
                                  ],
                                }),
                                (0, s.jsx)("div", {
                                  className:
                                    "text-[11px] font-bold text-black/40",
                                  children: ec
                                    ? "Clicca per ridurre"
                                    : "Clicca per espandere",
                                }),
                              ],
                            }),
                            (0, s.jsx)("div", {
                              className: (0, D.cn)(
                                "overflow-y-auto px-6 py-4 flex-1",
                                !ec && "hidden",
                              ),
                              children:
                                er.length > 0
                                  ? (0, s.jsx)("div", {
                                      className:
                                        "min-w-full inline-block align-middle",
                                      children: (0, s.jsx)("div", {
                                        className: "overflow-hidden",
                                        children: (0, s.jsxs)("table", {
                                          className:
                                            "min-w-full divide-y divide-black/[0.06]",
                                          children: [
                                            (0, s.jsx)("thead", {
                                              children: (0, s.jsxs)("tr", {
                                                className:
                                                  "text-left text-[10px] font-black uppercase tracking-[0.16em] text-black/40",
                                                children: [
                                                  (0, s.jsx)("th", {
                                                    scope: "col",
                                                    className: "pb-3 text-left",
                                                    children: "Orario",
                                                  }),
                                                  (0, s.jsx)("th", {
                                                    scope: "col",
                                                    className: "pb-3 text-left",
                                                    children: "Cliente",
                                                  }),
                                                  (0, s.jsx)("th", {
                                                    scope: "col",
                                                    className: "pb-3 text-left",
                                                    children: "Sede",
                                                  }),
                                                  (0, s.jsx)("th", {
                                                    scope: "col",
                                                    className: "pb-3 text-left",
                                                    children: "Staff",
                                                  }),
                                                  (0, s.jsx)("th", {
                                                    scope: "col",
                                                    className:
                                                      "pb-3 text-right",
                                                    children: "Stato",
                                                  }),
                                                ],
                                              }),
                                            }),
                                            (0, s.jsx)("tbody", {
                                              className:
                                                "divide-y divide-black/[0.04]",
                                              children: er.map((e) => {
                                                var t, a, l;
                                                let r;
                                                return (0, s.jsxs)(
                                                  "tr",
                                                  {
                                                    className:
                                                      "text-sm font-medium hover:bg-black/[0.01]",
                                                    children: [
                                                      (0, s.jsx)("td", {
                                                        className:
                                                          "py-3.5 whitespace-nowrap text-left",
                                                        children: (0, s.jsxs)(
                                                          "div",
                                                          {
                                                            className:
                                                              "flex flex-col text-left",
                                                            children: [
                                                              (0, s.jsxs)(
                                                                "div",
                                                                {
                                                                  className:
                                                                    "flex items-center gap-1.5 font-black text-[#171717]",
                                                                  children: [
                                                                    (0, s.jsx)(
                                                                      v.A,
                                                                      {
                                                                        className:
                                                                          "size-4 text-[#ff8bb2]",
                                                                      },
                                                                    ),
                                                                    e.time,
                                                                  ],
                                                                },
                                                              ),
                                                              (0, s.jsx)(
                                                                "span",
                                                                {
                                                                  className:
                                                                    "text-[10px] font-bold text-black/45 pl-[22px] mt-0.5",
                                                                  children:
                                                                    new Intl.DateTimeFormat(
                                                                      "it-IT",
                                                                      {
                                                                        day: "2-digit",
                                                                        month:
                                                                          "2-digit",
                                                                        timeZone:
                                                                          "Europe/Rome",
                                                                      },
                                                                    ).format(
                                                                      new Date(
                                                                        e.startDate,
                                                                      ),
                                                                    ),
                                                                },
                                                              ),
                                                              e.isTomorrow &&
                                                                (0, s.jsx)(
                                                                  "span",
                                                                  {
                                                                    className:
                                                                      "mt-0.5 inline-flex w-max items-center gap-1 rounded bg-[#EBF9EB] border border-[#D1F2D1] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#2E7D32]",
                                                                    children:
                                                                      "Domani",
                                                                  },
                                                                ),
                                                            ],
                                                          },
                                                        ),
                                                      }),
                                                      (0, s.jsx)("td", {
                                                        className:
                                                          "py-3.5 whitespace-nowrap text-left",
                                                        children: (0, s.jsxs)(
                                                          "button",
                                                          {
                                                            type: "button",
                                                            onClick: () =>
                                                              ew(e),
                                                            className:
                                                              "flex items-center gap-2.5 hover:opacity-80 transition text-left cursor-pointer outline-none group",
                                                            children: [
                                                              e.customerPhotoUrl
                                                                ? (0, s.jsx)(
                                                                    "img",
                                                                    {
                                                                      src: e.customerPhotoUrl,
                                                                      className:
                                                                        "size-8 rounded-full object-cover border border-black/10 group-hover:scale-105 transition duration-200",
                                                                      alt: "",
                                                                    },
                                                                  )
                                                                : (0, s.jsx)(
                                                                    "div",
                                                                    {
                                                                      className:
                                                                        "grid size-8 place-items-center rounded-full bg-[#ff8bb2]/15 text-[#a74758] border border-[#ff8bb2]/20 group-hover:scale-105 transition duration-200",
                                                                      children:
                                                                        (0,
                                                                        s.jsx)(
                                                                          y.A,
                                                                          {
                                                                            className:
                                                                              "size-4",
                                                                          },
                                                                        ),
                                                                    },
                                                                  ),
                                                              (0, s.jsxs)(
                                                                "div",
                                                                {
                                                                  className:
                                                                    "flex flex-col",
                                                                  children: [
                                                                    (0, s.jsxs)(
                                                                      "div",
                                                                      {
                                                                        className:
                                                                          "flex items-baseline gap-2 flex-wrap",
                                                                        children:
                                                                          [
                                                                            (0,
                                                                            s.jsx)(
                                                                              "span",
                                                                              {
                                                                                className:
                                                                                  "text-sm font-black text-[#171717] group-hover:text-[#a74758] transition duration-200",
                                                                                children:
                                                                                  e.customerName,
                                                                              },
                                                                            ),
                                                                            (0,
                                                                            s.jsx)(
                                                                              "span",
                                                                              {
                                                                                className:
                                                                                  "text-[11px] font-semibold text-[#a74758]/70 bg-[#a74758]/5 border border-[#a74758]/10 px-2 py-0.5 rounded-full",
                                                                                children:
                                                                                  e.serviceTitle,
                                                                              },
                                                                            ),
                                                                          ],
                                                                      },
                                                                    ),
                                                                    null !==
                                                                      e.priceAmount &&
                                                                    e.priceAmount >
                                                                      0
                                                                      ? (0,
                                                                        s.jsxs)(
                                                                          "span",
                                                                          {
                                                                            className:
                                                                              "text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 w-max mt-1",
                                                                            children:
                                                                              [
                                                                                "Acconto: ",
                                                                                e.priceAmount.toLocaleString(
                                                                                  "it-IT",
                                                                                  {
                                                                                    style:
                                                                                      "currency",
                                                                                    currency:
                                                                                      e.priceCurrency,
                                                                                  },
                                                                                ),
                                                                              ],
                                                                          },
                                                                        )
                                                                      : null,
                                                                  ],
                                                                },
                                                              ),
                                                            ],
                                                          },
                                                        ),
                                                      }),
                                                      (0, s.jsx)("td", {
                                                        className:
                                                          "py-3.5 whitespace-nowrap text-left text-xs font-semibold text-black/60 capitalize",
                                                        children:
                                                          "buenos-aires" ===
                                                          e.inferredSalon
                                                            ? "Buenos Aires"
                                                            : e.inferredSalon,
                                                      }),
                                                      (0, s.jsx)("td", {
                                                        className:
                                                          "py-3.5 whitespace-nowrap text-left",
                                                        children: (0, s.jsx)(
                                                          "div",
                                                          {
                                                            className:
                                                              "flex flex-wrap gap-1.5 items-center",
                                                            children:
                                                              e.teammates
                                                                .length > 0
                                                                ? e.teammates.map(
                                                                    (e, t) =>
                                                                      (0,
                                                                      s.jsxs)(
                                                                        "div",
                                                                        {
                                                                          className:
                                                                            "flex items-center gap-1 bg-black/[0.03] border border-black/5 rounded-full pl-1 pr-2.5 py-0.5",
                                                                          children:
                                                                            [
                                                                              e.photoUrl
                                                                                ? (0,
                                                                                  s.jsx)(
                                                                                    "img",
                                                                                    {
                                                                                      src: e.photoUrl,
                                                                                      className:
                                                                                        "size-5 rounded-full object-cover",
                                                                                      alt: "",
                                                                                    },
                                                                                  )
                                                                                : (0,
                                                                                  s.jsx)(
                                                                                    "div",
                                                                                    {
                                                                                      className:
                                                                                        "grid size-5 place-items-center rounded-full bg-[#ff8bb2]/10 text-[#a74758] text-[9px] font-black",
                                                                                      children:
                                                                                        e.name.charAt(
                                                                                          0,
                                                                                        ),
                                                                                    },
                                                                                  ),
                                                                              (0,
                                                                              s.jsx)(
                                                                                "span",
                                                                                {
                                                                                  className:
                                                                                    "text-[11px] font-bold text-black/75",
                                                                                  children:
                                                                                    e.name,
                                                                                },
                                                                              ),
                                                                            ],
                                                                        },
                                                                        t,
                                                                      ),
                                                                  )
                                                                : (0, s.jsx)(
                                                                    "span",
                                                                    {
                                                                      className:
                                                                        "text-xs text-black/35 italic font-bold",
                                                                      children:
                                                                        "Non assegnato",
                                                                    },
                                                                  ),
                                                          },
                                                        ),
                                                      }),
                                                      (0, s.jsx)("td", {
                                                        className:
                                                          "py-3.5 whitespace-nowrap text-right",
                                                        children:
                                                          ((t = e.status),
                                                          (a = () => tV(e)),
                                                          (l = () => {
                                                            var t;
                                                            return (
                                                              (t = e.id),
                                                              void (el((e) => {
                                                                let a = new Set(
                                                                  e,
                                                                );
                                                                return (
                                                                  a.add(t),
                                                                  a
                                                                );
                                                              }),
                                                              tL("success"))
                                                            );
                                                          }),
                                                          (r = t
                                                            .toLowerCase()
                                                            .replace(
                                                              /_/g,
                                                              " ",
                                                            )).includes(
                                                            "arrivando",
                                                          ) || "arrived" === r
                                                            ? (0, s.jsxs)(
                                                                "span",
                                                                {
                                                                  className:
                                                                    "inline-flex items-center gap-1.5 rounded-full border border-[#FCDCE2] bg-[#FFF0F2] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#E88AC5]",
                                                                  children: [
                                                                    (0, s.jsx)(
                                                                      "span",
                                                                      {
                                                                        className:
                                                                          "size-1.5 rounded-full bg-[#E88AC5] animate-pulse",
                                                                      },
                                                                    ),
                                                                    "Sta Arrivando",
                                                                  ],
                                                                },
                                                              )
                                                            : r.includes(
                                                                  "in arrivo",
                                                                ) ||
                                                                "pending" === r
                                                              ? (0, s.jsxs)(
                                                                  "span",
                                                                  {
                                                                    className:
                                                                      "inline-flex items-center gap-1.5 rounded-full border border-[#FBEAD2] bg-[#FFF8EB] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#F1A43A]",
                                                                    children: [
                                                                      (0,
                                                                      s.jsx)(
                                                                        "span",
                                                                        {
                                                                          className:
                                                                            "size-1.5 rounded-full bg-[#F1A43A]",
                                                                        },
                                                                      ),
                                                                      "In Arrivo",
                                                                    ],
                                                                  },
                                                                )
                                                              : r.includes(
                                                                    "confermato",
                                                                  ) ||
                                                                  "confirmed" ===
                                                                    r ||
                                                                  "confermata" ===
                                                                    r
                                                                ? (0, s.jsxs)(
                                                                    "div",
                                                                    {
                                                                      className:
                                                                        "flex gap-2 justify-end items-center",
                                                                      children:
                                                                        [
                                                                          (0,
                                                                          s.jsxs)(
                                                                            "button",
                                                                            {
                                                                              type: "button",
                                                                              onClick:
                                                                                (
                                                                                  e,
                                                                                ) => {
                                                                                  (e.stopPropagation(),
                                                                                    a?.());
                                                                                },
                                                                              className:
                                                                                "inline-flex items-center gap-1 rounded-full border border-[#D1F2D1] bg-[#EBF9EB] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#2E7D32] hover:bg-[#D8F3D8] hover:border-[#BCE8BC] active:scale-95 transition shadow-sm",
                                                                              children:
                                                                                [
                                                                                  (0,
                                                                                  s.jsx)(
                                                                                    "span",
                                                                                    {
                                                                                      className:
                                                                                        "size-1.5 rounded-full bg-[#2E7D32]",
                                                                                    },
                                                                                  ),
                                                                                  "Crea appuntamento",
                                                                                ],
                                                                            },
                                                                          ),
                                                                          (0,
                                                                          s.jsx)(
                                                                            "button",
                                                                            {
                                                                              type: "button",
                                                                              onClick:
                                                                                (
                                                                                  e,
                                                                                ) => {
                                                                                  (e.stopPropagation(),
                                                                                    l?.());
                                                                                },
                                                                              className:
                                                                                "inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black/60 hover:bg-black/[0.02] hover:border-black/15 active:scale-95 transition shadow-sm",
                                                                              children:
                                                                                "Finito",
                                                                            },
                                                                          ),
                                                                        ],
                                                                    },
                                                                  )
                                                                : (0, s.jsxs)(
                                                                    "span",
                                                                    {
                                                                      className:
                                                                        "inline-flex items-center gap-1.5 rounded-full border border-[#D5E5FA] bg-[#EDF4FC] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#4E89E8]",
                                                                      children:
                                                                        [
                                                                          (0,
                                                                          s.jsx)(
                                                                            "span",
                                                                            {
                                                                              className:
                                                                                "size-1.5 rounded-full bg-[#4E89E8]",
                                                                            },
                                                                          ),
                                                                          "In Preparazione",
                                                                        ],
                                                                    },
                                                                  )),
                                                      }),
                                                    ],
                                                  },
                                                  e.id,
                                                );
                                              }),
                                            }),
                                          ],
                                        }),
                                      }),
                                    })
                                  : (0, s.jsxs)("div", {
                                      className:
                                        "flex flex-col items-center justify-center py-6 text-center text-sm font-bold text-black/35 gap-2",
                                      children: [
                                        (0, s.jsx)(N.A, {
                                          className: "size-8 text-black/20",
                                        }),
                                        "Nessun appuntamento in programma per oggi in questo salone.",
                                      ],
                                    }),
                            }),
                          ],
                        }),
                      ],
                    }),
                eN && c
                  ? (0, s.jsx)("div", {
                      className:
                        "absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5",
                      children: (0, s.jsxs)("div", {
                        className:
                          "flex h-[92%] w-full max-w-[1500px] overflow-hidden rounded-[26px] border border-black/15 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.35)]",
                        children: [
                          null,
                          (0, s.jsxs)("aside", {
                            className:
                              "flex w-full min-w-0 flex-col bg-[#FAFAFA] p-5 sm:p-7",
                            children: [
                              (0, s.jsxs)("div", {
                                className:
                                  "flex items-start justify-between gap-3",
                                children: [
                                  (0, s.jsxs)("div", {
                                    children: [
                                      (0, s.jsx)("p", {
                                        className:
                                          "text-[10px] font-black uppercase tracking-[0.24em] text-[#E88AC5]",
                                        children: "Store manager",
                                      }),
                                      (0, s.jsx)("h2", {
                                        className:
                                          "mt-1 text-2xl font-black text-[#171717] sm:text-3xl",
                                        children:
                                          "Appuntamenti e controllo cliente",
                                      }),
                                      (0, s.jsx)("p", {
                                        className:
                                          "mt-1 text-xs font-semibold text-black/45",
                                        children:
                                          "Compila appuntamenti dal tablet e controlla l'andamento per salone.",
                                      }),
                                      (0, s.jsxs)("div", {
                                        className: "mt-3 flex flex-wrap gap-2",
                                        children: [
                                          (0, s.jsx)("button", {
                                            type: "button",
                                            onClick: () => eF("create"),
                                            className: (0, D.cn)(
                                              "rounded-full px-4 py-2 text-xs font-black",
                                              "create" === eI
                                                ? "bg-[#171717] text-white"
                                                : "bg-black/5 text-black/55",
                                            ),
                                            children: "Crea appuntamento",
                                          }),
                                          (0, s.jsx)("button", {
                                            type: "button",
                                            onClick: () => eF("analytics"),
                                            className: (0, D.cn)(
                                              "rounded-full px-4 py-2 text-xs font-black",
                                              "analytics" === eI
                                                ? "bg-[#171717] text-white"
                                                : "bg-black/5 text-black/55",
                                            ),
                                            children: "Analytics",
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                  (0, s.jsx)("button", {
                                    type: "button",
                                    onClick: () => {
                                      (ev(!1), eC(!1));
                                    },
                                    className:
                                      "grid size-11 place-items-center rounded-full border border-black/10 bg-white text-black shadow-sm active:scale-95",
                                    children: (0, s.jsx)(x.A, {
                                      className: "size-5",
                                    }),
                                  }),
                                ],
                              }),
                              (0, s.jsxs)("div", {
                                className:
                                  "mt-4 min-h-0 flex-1 overflow-y-auto pr-1",
                                children: [
                                  "create" === eI
                                    ? (0, s.jsx)("div", {
                                        className:
                                          "mb-4 rounded-[26px] border border-black/10 bg-white p-4 shadow-sm sm:p-5",
                                        children: (0, s.jsx)("div", {
                                          className: "w-full",
                                          children: (0, s.jsxs)("div", {
                                            className: "space-y-4",
                                            children: [
                                              (0, s.jsxs)("div", {
                                                children: [
                                                  (0, s.jsx)("p", {
                                                    className:
                                                      "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                    children: "Sede",
                                                  }),
                                                  (0, s.jsx)("div", {
                                                    className:
                                                      "mt-2 flex flex-wrap gap-2",
                                                    children: tE.map((e) =>
                                                      (0, s.jsx)(
                                                        "button",
                                                        {
                                                          type: "button",
                                                          onClick: () =>
                                                            eP((t) => ({
                                                              ...t,
                                                              salon: e,
                                                              staffIds: [],
                                                            })),
                                                          className: (0, D.cn)(
                                                            "rounded-full border px-3 py-2 text-xs font-black",
                                                            eD.salon === e
                                                              ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                                                              : "border-black/10 bg-white text-black/55",
                                                          ),
                                                          children: e,
                                                        },
                                                        e,
                                                      ),
                                                    ),
                                                  }),
                                                ],
                                              }),
                                              (0, s.jsxs)("div", {
                                                className:
                                                  "grid gap-3 md:grid-cols-2",
                                                children: [
                                                  (0, s.jsxs)("label", {
                                                    className: "block",
                                                    children: [
                                                      (0, s.jsx)("span", {
                                                        className:
                                                          "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                        children:
                                                          "Nome cliente *",
                                                      }),
                                                      (0, s.jsx)("input", {
                                                        value: eD.clientName,
                                                        onChange: (e) =>
                                                          eP((t) => ({
                                                            ...t,
                                                            clientName:
                                                              e.target.value,
                                                          })),
                                                        className:
                                                          "mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]",
                                                        placeholder:
                                                          "Nome cliente",
                                                      }),
                                                    ],
                                                  }),
                                                  (0, s.jsxs)("label", {
                                                    className: "block",
                                                    children: [
                                                      (0, s.jsx)("span", {
                                                        className:
                                                          "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                        children:
                                                          "Servizio prenotato",
                                                      }),
                                                      (0, s.jsx)("input", {
                                                        value:
                                                          eD.serviceTitle || "",
                                                        readOnly: !0,
                                                        className:
                                                          "mt-1 h-12 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-sm font-bold text-black/60 outline-none cursor-not-allowed",
                                                        placeholder:
                                                          "Nessun servizio",
                                                      }),
                                                    ],
                                                  }),
                                                  (0, s.jsxs)("label", {
                                                    className: "block",
                                                    children: [
                                                      (0, s.jsx)("span", {
                                                        className:
                                                          "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                        children:
                                                          "Ordine Shopify *",
                                                      }),
                                                      (0, s.jsx)("input", {
                                                        value: eD.shopifyOrder,
                                                        onChange: (e) =>
                                                          eP((t) => ({
                                                            ...t,
                                                            shopifyOrder:
                                                              e.target.value,
                                                          })),
                                                        className:
                                                          "mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]",
                                                        placeholder:
                                                          "Numero ordine",
                                                      }),
                                                    ],
                                                  }),
                                                  (0, s.jsxs)("label", {
                                                    className: "block",
                                                    children: [
                                                      (0, s.jsx)("span", {
                                                        className:
                                                          "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                        children:
                                                          "Acconto pagato",
                                                      }),
                                                      (0, s.jsx)("input", {
                                                        inputMode: "decimal",
                                                        value: eD.depositPaid,
                                                        onChange: (e) =>
                                                          eP((t) => ({
                                                            ...t,
                                                            depositPaid:
                                                              e.target.value,
                                                          })),
                                                        className:
                                                          "mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]",
                                                        placeholder: "0,00",
                                                      }),
                                                    ],
                                                  }),
                                                  (0, s.jsxs)("label", {
                                                    className: "block",
                                                    children: [
                                                      (0, s.jsx)("span", {
                                                        className:
                                                          "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                        children: "Pagato",
                                                      }),
                                                      (0, s.jsx)("input", {
                                                        inputMode: "decimal",
                                                        value: eD.paid,
                                                        onChange: (e) =>
                                                          eP((t) => ({
                                                            ...t,
                                                            paid: e.target
                                                              .value,
                                                          })),
                                                        className:
                                                          "mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]",
                                                        placeholder: "0,00",
                                                      }),
                                                    ],
                                                  }),
                                                ],
                                              }),
                                              (0, s.jsxs)("div", {
                                                children: [
                                                  (0, s.jsx)("p", {
                                                    className:
                                                      "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                    children:
                                                      "Collaboratori del salone",
                                                  }),
                                                  (0, s.jsx)("div", {
                                                    className:
                                                      "mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-2xl border border-black/10 bg-black/[0.02] p-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
                                                    children: tM.length
                                                      ? tM.map((e) => {
                                                          let t =
                                                            eD.staffIds.includes(
                                                              e.id,
                                                            );
                                                          return (0, s.jsx)(
                                                            "button",
                                                            {
                                                              type: "button",
                                                              onClick: () =>
                                                                eP((a) => ({
                                                                  ...a,
                                                                  staffIds: t
                                                                    ? a.staffIds.filter(
                                                                        (t) =>
                                                                          t !==
                                                                          e.id,
                                                                      )
                                                                    : [
                                                                        ...a.staffIds,
                                                                        e.id,
                                                                      ],
                                                                })),
                                                              className: (0,
                                                              D.cn)(
                                                                "rounded-xl border px-3 py-2 text-left text-xs font-black",
                                                                t
                                                                  ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                                                                  : "border-black/10 bg-white text-black/60",
                                                              ),
                                                              children: e.name,
                                                            },
                                                            e.id,
                                                          );
                                                        })
                                                      : (0, s.jsx)("p", {
                                                          className:
                                                            "p-3 text-sm font-bold text-black/40",
                                                          children:
                                                            "Nessun collaboratore trovato per questa sede.",
                                                        }),
                                                  }),
                                                ],
                                              }),
                                              (0, s.jsxs)("label", {
                                                className: "block",
                                                children: [
                                                  (0, s.jsx)("span", {
                                                    className:
                                                      "text-[10px] font-black uppercase tracking-[0.18em] text-black/40",
                                                    children: "IG tag",
                                                  }),
                                                  (0, s.jsx)("input", {
                                                    value: eD.instagramTag,
                                                    onChange: (e) =>
                                                      eP((t) => ({
                                                        ...t,
                                                        instagramTag:
                                                          e.target.value,
                                                      })),
                                                    className:
                                                      "mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]",
                                                    placeholder: "@cliente",
                                                  }),
                                                ],
                                              }),
                                              (0, s.jsx)("div", {
                                                className:
                                                  "grid gap-2 sm:grid-cols-2 lg:grid-cols-5",
                                                children: [
                                                  ["notes", "Note Shopify"],
                                                  [
                                                    "beforeMedia",
                                                    "Prima foto/video",
                                                  ],
                                                  [
                                                    "afterMedia",
                                                    "Dopo foto/video",
                                                  ],
                                                  ["products", "Prodotti"],
                                                  ["review", "Recensione"],
                                                ].map(([e, t]) =>
                                                  (0, s.jsxs)(
                                                    "label",
                                                    {
                                                      className:
                                                        "flex min-h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 text-xs font-black text-black/60",
                                                      children: [
                                                        (0, s.jsx)("input", {
                                                          type: "checkbox",
                                                          checked: !!eD[e],
                                                          onChange: (t) =>
                                                            eP((a) => ({
                                                              ...a,
                                                              [e]: t.target
                                                                .checked,
                                                            })),
                                                          className:
                                                            "size-4 accent-[#E88AC5]",
                                                        }),
                                                        t,
                                                      ],
                                                    },
                                                    e,
                                                  ),
                                                ),
                                              }),
                                              eR
                                                ? (0, s.jsx)("p", {
                                                    className: (0, D.cn)(
                                                      "rounded-2xl px-4 py-3 text-sm font-black",
                                                      "success" === eR.type
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-red-50 text-red-700",
                                                    ),
                                                    children: eR.text,
                                                  })
                                                : null,
                                              (0, s.jsx)("button", {
                                                type: "button",
                                                onClick: () => void tO(),
                                                disabled: eO,
                                                className:
                                                  "h-13 w-full rounded-2xl bg-[#E88AC5] px-5 py-4 text-sm font-black text-white shadow-lg shadow-pink-200 active:scale-[0.99] disabled:opacity-60",
                                                children: eO
                                                  ? "Salvataggio..."
                                                  : "Salva appuntamento",
                                              }),
                                            ],
                                          }),
                                        }),
                                      })
                                    : null,
                                  eT
                                    ? (0, s.jsx)("div", {
                                        className:
                                          "grid h-full place-items-center text-sm font-bold text-black/45",
                                        children: "Carico analytics...",
                                      })
                                    : eS?.salons.length
                                      ? (0, s.jsxs)("div", {
                                          className: "space-y-4",
                                          children: [
                                            (0, s.jsx)("div", {
                                              className:
                                                "flex gap-2 overflow-x-auto pb-1",
                                              children: [
                                                "Tutti",
                                                ...eS.salons.map(
                                                  (e) => e.salon,
                                                ),
                                              ].map((e) =>
                                                (0, s.jsx)(
                                                  "button",
                                                  {
                                                    type: "button",
                                                    onClick: () => e_(e),
                                                    className: (0, D.cn)(
                                                      "shrink-0 rounded-full px-3 py-2 text-[11px] font-black transition",
                                                      eM === e
                                                        ? "bg-[#171717] text-white"
                                                        : "bg-black/5 text-black/55 hover:bg-black/10",
                                                    ),
                                                    children: e,
                                                  },
                                                  e,
                                                ),
                                              ),
                                            }),
                                            (0, s.jsxs)("div", {
                                              className:
                                                "grid grid-cols-1 gap-3 sm:grid-cols-3",
                                              children: [
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "rounded-[18px] border border-black/10 bg-white p-4 shadow-sm",
                                                  children: [
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "text-[9px] font-black uppercase tracking-[0.18em] text-black/40",
                                                      children: "Schede mese",
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-2 text-3xl font-black text-[#171717]",
                                                      children:
                                                        t_?.responses ?? 0,
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-1 truncate text-[11px] font-semibold text-black/40",
                                                      children: t_?.salon,
                                                    }),
                                                  ],
                                                }),
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "rounded-[18px] border border-black/10 bg-white p-4 shadow-sm",
                                                  children: [
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "text-[9px] font-black uppercase tracking-[0.18em] text-black/40",
                                                      children: "Collaboratori",
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-2 text-3xl font-black text-[#171717]",
                                                      children:
                                                        t_?.staff.length ?? 0,
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-1 text-[11px] font-semibold text-black/40",
                                                      children:
                                                        "con check attivi",
                                                    }),
                                                  ],
                                                }),
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "rounded-[18px] border border-black/10 bg-white p-4 shadow-sm",
                                                  children: [
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "text-[9px] font-black uppercase tracking-[0.18em] text-black/40",
                                                      children: "Check totali",
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-2 text-3xl font-black text-[#171717]",
                                                      children:
                                                        t_?.staff.reduce(
                                                          (e, t) =>
                                                            e + t.checks,
                                                          0,
                                                        ) ?? 0,
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-1 text-[11px] font-semibold text-black/40",
                                                      children:
                                                        "note, foto, prodotti",
                                                    }),
                                                  ],
                                                }),
                                              ],
                                            }),
                                            (0, s.jsxs)("div", {
                                              className:
                                                "grid grid-cols-1 gap-3 xl:grid-cols-[1fr_260px]",
                                              children: [
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "rounded-[22px] border border-black/10 bg-white p-4 shadow-sm",
                                                  children: [
                                                    (0, s.jsxs)("div", {
                                                      className:
                                                        "mb-3 flex items-center justify-between",
                                                      children: [
                                                        (0, s.jsx)("p", {
                                                          className:
                                                            "text-[10px] font-black uppercase tracking-[0.18em] text-black/45",
                                                          children:
                                                            "Produttivit\xe0",
                                                        }),
                                                        (0, s.jsx)(C.A, {
                                                          className:
                                                            "size-4 text-[#E88AC5]",
                                                        }),
                                                      ],
                                                    }),
                                                    (0, s.jsx)("div", {
                                                      className: "space-y-2",
                                                      children: (
                                                        t_?.staff ?? []
                                                      )
                                                        .slice(0, 8)
                                                        .map((e) => {
                                                          let t = Math.max(
                                                            ...(
                                                              t_?.staff ?? []
                                                            ).map(
                                                              (e) => e.services,
                                                            ),
                                                            1,
                                                          );
                                                          return (0, s.jsxs)(
                                                            "div",
                                                            {
                                                              className:
                                                                "grid grid-cols-[120px_1fr_32px] items-center gap-2",
                                                              children: [
                                                                (0, s.jsx)(
                                                                  "p",
                                                                  {
                                                                    className:
                                                                      "truncate text-[11px] font-bold text-black/55",
                                                                    children:
                                                                      e.name,
                                                                  },
                                                                ),
                                                                (0, s.jsx)(
                                                                  "div",
                                                                  {
                                                                    className:
                                                                      "h-2.5 overflow-hidden rounded-full bg-[#F7DFEB]",
                                                                    children:
                                                                      (0,
                                                                      s.jsx)(
                                                                        "div",
                                                                        {
                                                                          className:
                                                                            "h-full rounded-full bg-[#E88AC5]",
                                                                          style:
                                                                            {
                                                                              width: `${Math.max(5, (e.services / t) * 100)}%`,
                                                                            },
                                                                        },
                                                                      ),
                                                                  },
                                                                ),
                                                                (0, s.jsx)(
                                                                  "p",
                                                                  {
                                                                    className:
                                                                      "text-right text-[11px] font-black text-black/55",
                                                                    children:
                                                                      e.services,
                                                                  },
                                                                ),
                                                              ],
                                                            },
                                                            e.name,
                                                          );
                                                        }),
                                                    }),
                                                  ],
                                                }),
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "rounded-[22px] border border-black/10 bg-white p-4 text-center shadow-sm",
                                                  children: [
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "text-[10px] font-black uppercase tracking-[0.18em] text-black/45",
                                                      children:
                                                        "Appuntamenti per sede",
                                                    }),
                                                    (0, s.jsx)("div", {
                                                      className:
                                                        "mx-auto mt-4 grid size-28 place-items-center rounded-full",
                                                      style: {
                                                        background:
                                                          "conic-gradient(#F1C45D 0deg 330deg, #F6DCE9 330deg 360deg)",
                                                      },
                                                      children: (0, s.jsx)(
                                                        "div",
                                                        {
                                                          className:
                                                            "grid size-20 place-items-center rounded-full bg-white",
                                                          children: (0, s.jsxs)(
                                                            "div",
                                                            {
                                                              children: [
                                                                (0, s.jsx)(
                                                                  "p",
                                                                  {
                                                                    className:
                                                                      "text-3xl font-black",
                                                                    children:
                                                                      t_?.responses ??
                                                                      0,
                                                                  },
                                                                ),
                                                                (0, s.jsx)(
                                                                  "p",
                                                                  {
                                                                    className:
                                                                      "text-[10px] font-bold text-black/40",
                                                                    children:
                                                                      "Total",
                                                                  },
                                                                ),
                                                              ],
                                                            },
                                                          ),
                                                        },
                                                      ),
                                                    }),
                                                    (0, s.jsx)("p", {
                                                      className:
                                                        "mt-3 truncate text-[10px] font-bold text-black/40",
                                                      children: t_?.salon,
                                                    }),
                                                  ],
                                                }),
                                              ],
                                            }),
                                            (0, s.jsx)("div", {
                                              className:
                                                "grid grid-cols-1 gap-3 md:grid-cols-3",
                                              children: [
                                                {
                                                  title: "Note & foto",
                                                  key: "notePhoto",
                                                  color: "#C590DD",
                                                },
                                                {
                                                  title: "Recensioni",
                                                  key: "reviews",
                                                  color: "#5AA4F2",
                                                },
                                                {
                                                  title: "Prodotti",
                                                  key: "products",
                                                  color: "#53BAC7",
                                                },
                                              ].map((e) => {
                                                let t = (t_?.staff ?? [])
                                                    .filter((t) => t[e.key] > 0)
                                                    .slice(0, 4),
                                                  a = Math.max(
                                                    ...t.map((t) => t[e.key]),
                                                    1,
                                                  );
                                                return (0, s.jsxs)(
                                                  "div",
                                                  {
                                                    className:
                                                      "rounded-[22px] border border-black/10 bg-white p-3 shadow-sm",
                                                    children: [
                                                      (0, s.jsx)("p", {
                                                        className:
                                                          "text-[9px] font-black uppercase tracking-[0.14em] text-black/45",
                                                        children: e.title,
                                                      }),
                                                      (0, s.jsx)("div", {
                                                        className:
                                                          "mt-3 flex h-32 items-end justify-around gap-2 border-b border-black/10 px-1",
                                                        children: t.length
                                                          ? t.map((t) =>
                                                              (0, s.jsxs)(
                                                                "div",
                                                                {
                                                                  className:
                                                                    "flex min-w-0 flex-1 flex-col items-center gap-1",
                                                                  children: [
                                                                    (0, s.jsx)(
                                                                      "p",
                                                                      {
                                                                        className:
                                                                          "text-[10px] font-black text-black/55",
                                                                        children:
                                                                          t[
                                                                            e
                                                                              .key
                                                                          ],
                                                                      },
                                                                    ),
                                                                    (0, s.jsx)(
                                                                      "div",
                                                                      {
                                                                        className:
                                                                          "w-6 rounded-t-lg",
                                                                        style: {
                                                                          height: `${Math.max(12, (t[e.key] / a) * 92)}px`,
                                                                          backgroundColor:
                                                                            e.color,
                                                                        },
                                                                      },
                                                                    ),
                                                                  ],
                                                                },
                                                                t.name,
                                                              ),
                                                            )
                                                          : (0, s.jsx)("div", {
                                                              className:
                                                                "grid h-full place-items-center text-[11px] font-bold text-black/30",
                                                              children: "0",
                                                            }),
                                                      }),
                                                      (0, s.jsx)("div", {
                                                        className:
                                                          "mt-2 grid grid-cols-2 gap-1",
                                                        children: t
                                                          .slice(0, 4)
                                                          .map((e) =>
                                                            (0, s.jsx)(
                                                              "p",
                                                              {
                                                                className:
                                                                  "truncate text-[9px] font-bold text-black/45",
                                                                children:
                                                                  e.name,
                                                              },
                                                              e.name,
                                                            ),
                                                          ),
                                                      }),
                                                    ],
                                                  },
                                                  e.key,
                                                );
                                              }),
                                            }),
                                            (0, s.jsxs)("div", {
                                              className:
                                                "rounded-[24px] border border-black/10 bg-white shadow-sm",
                                              children: [
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "flex flex-col gap-2 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between",
                                                  children: [
                                                    (0, s.jsxs)("div", {
                                                      children: [
                                                        (0, s.jsx)("p", {
                                                          className:
                                                            "text-[10px] font-black uppercase tracking-[0.2em] text-[#E88AC5]",
                                                          children:
                                                            "Cronologia",
                                                        }),
                                                        (0, s.jsx)("h3", {
                                                          className:
                                                            "text-xl font-black text-[#171717]",
                                                          children:
                                                            "Moduli Controllo Cliente completati",
                                                        }),
                                                      ],
                                                    }),
                                                    (0, s.jsxs)("p", {
                                                      className:
                                                        "rounded-full bg-black/5 px-3 py-1 text-xs font-black text-black/45",
                                                      children: [
                                                        eS.recent?.length ?? 0,
                                                        " recenti",
                                                      ],
                                                    }),
                                                  ],
                                                }),
                                                (0, s.jsx)("div", {
                                                  className:
                                                    "max-h-[340px] overflow-y-auto",
                                                  children: (eS.recent ?? [])
                                                    .length
                                                    ? (0, s.jsx)("div", {
                                                        className:
                                                          "divide-y divide-black/5",
                                                        children: (
                                                          eS.recent ?? []
                                                        ).map((e) =>
                                                          (0, s.jsxs)(
                                                            "article",
                                                            {
                                                              className:
                                                                "grid gap-4 p-4 text-sm lg:grid-cols-[160px_minmax(220px,1fr)_190px_220px] lg:items-center",
                                                              children: [
                                                                (0, s.jsxs)(
                                                                  "div",
                                                                  {
                                                                    children: [
                                                                      (0,
                                                                      s.jsx)(
                                                                        "p",
                                                                        {
                                                                          className:
                                                                            "font-black text-[#171717]",
                                                                          children:
                                                                            new Intl.DateTimeFormat(
                                                                              "it-IT",
                                                                              {
                                                                                day: "2-digit",
                                                                                month:
                                                                                  "short",
                                                                                hour: "2-digit",
                                                                                minute:
                                                                                  "2-digit",
                                                                              },
                                                                            ).format(
                                                                              new Date(
                                                                                e.createdAt,
                                                                              ),
                                                                            ),
                                                                        },
                                                                      ),
                                                                      (0,
                                                                      s.jsx)(
                                                                        "p",
                                                                        {
                                                                          className:
                                                                            "text-xs font-bold text-black/40",
                                                                          children:
                                                                            e.salon,
                                                                        },
                                                                      ),
                                                                    ],
                                                                  },
                                                                ),
                                                                (0, s.jsxs)(
                                                                  "div",
                                                                  {
                                                                    className:
                                                                      "min-w-0",
                                                                    children: [
                                                                      (0,
                                                                      s.jsx)(
                                                                        "p",
                                                                        {
                                                                          className:
                                                                            "truncate font-black text-[#171717]",
                                                                          children:
                                                                            e.client ||
                                                                            "Cliente senza nome",
                                                                        },
                                                                      ),
                                                                      (0,
                                                                      s.jsx)(
                                                                        "p",
                                                                        {
                                                                          className:
                                                                            "truncate text-xs font-semibold text-black/45",
                                                                          children:
                                                                            e.staff.join(
                                                                              ", ",
                                                                            ),
                                                                        },
                                                                      ),
                                                                    ],
                                                                  },
                                                                ),
                                                                (0, s.jsxs)(
                                                                  "div",
                                                                  {
                                                                    className:
                                                                      "space-y-1 rounded-2xl bg-black/[0.03] px-3 py-2 text-xs font-bold text-black/50",
                                                                    children: [
                                                                      (0,
                                                                      s.jsxs)(
                                                                        "p",
                                                                        {
                                                                          className:
                                                                            "flex items-center justify-between gap-3",
                                                                          children:
                                                                            [
                                                                              (0,
                                                                              s.jsx)(
                                                                                "span",
                                                                                {
                                                                                  children:
                                                                                    "Pagato",
                                                                                },
                                                                              ),
                                                                              (0,
                                                                              s.jsx)(
                                                                                "span",
                                                                                {
                                                                                  className:
                                                                                    "shrink-0 text-[#171717]",
                                                                                  children:
                                                                                    e.paid.toLocaleString(
                                                                                      "it-IT",
                                                                                      {
                                                                                        style:
                                                                                          "currency",
                                                                                        currency:
                                                                                          "EUR",
                                                                                      },
                                                                                    ),
                                                                                },
                                                                              ),
                                                                            ],
                                                                        },
                                                                      ),
                                                                      (0,
                                                                      s.jsxs)(
                                                                        "p",
                                                                        {
                                                                          className:
                                                                            "flex items-center justify-between gap-3",
                                                                          children:
                                                                            [
                                                                              (0,
                                                                              s.jsx)(
                                                                                "span",
                                                                                {
                                                                                  children:
                                                                                    "Acconto",
                                                                                },
                                                                              ),
                                                                              (0,
                                                                              s.jsx)(
                                                                                "span",
                                                                                {
                                                                                  className:
                                                                                    "shrink-0 text-[#171717]",
                                                                                  children:
                                                                                    e.deposit.toLocaleString(
                                                                                      "it-IT",
                                                                                      {
                                                                                        style:
                                                                                          "currency",
                                                                                        currency:
                                                                                          "EUR",
                                                                                      },
                                                                                    ),
                                                                                },
                                                                              ),
                                                                            ],
                                                                        },
                                                                      ),
                                                                    ],
                                                                  },
                                                                ),
                                                                (0, s.jsxs)(
                                                                  "div",
                                                                  {
                                                                    className:
                                                                      "flex flex-col gap-2 lg:items-end",
                                                                    children: [
                                                                      (0,
                                                                      s.jsxs)(
                                                                        "div",
                                                                        {
                                                                          className:
                                                                            "flex flex-wrap items-center gap-2 lg:justify-end",
                                                                          children:
                                                                            [
                                                                              (0,
                                                                              s.jsxs)(
                                                                                "span",
                                                                                {
                                                                                  className:
                                                                                    (0,
                                                                                    D.cn)(
                                                                                      "rounded-full px-2.5 py-1 text-xs font-black",
                                                                                      e.counts
                                                                                        ? "bg-emerald-50 text-emerald-700"
                                                                                        : "bg-red-50 text-red-700",
                                                                                    ),
                                                                                  children:
                                                                                    [
                                                                                      e.checkCount,
                                                                                      "/5",
                                                                                    ],
                                                                                },
                                                                              ),
                                                                              (0,
                                                                              s.jsx)(
                                                                                "span",
                                                                                {
                                                                                  className:
                                                                                    "rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-black text-black/45",
                                                                                  children:
                                                                                    e.correctness,
                                                                                },
                                                                              ),
                                                                            ],
                                                                        },
                                                                      ),
                                                                      (0,
                                                                      s.jsxs)(
                                                                        "button",
                                                                        {
                                                                          type: "button",
                                                                          onClick:
                                                                            () =>
                                                                              tD(
                                                                                e.id,
                                                                              ),
                                                                          disabled:
                                                                            eV ===
                                                                            e.id,
                                                                          className:
                                                                            "inline-flex items-center justify-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-black text-black/60 transition hover:bg-[#fff2fa] hover:text-[#171717] disabled:opacity-60",
                                                                          children:
                                                                            [
                                                                              (0,
                                                                              s.jsx)(
                                                                                S.A,
                                                                                {
                                                                                  className:
                                                                                    "size-3",
                                                                                },
                                                                              ),
                                                                              eV ===
                                                                              e.id
                                                                                ? "Apro..."
                                                                                : "Modifica",
                                                                            ],
                                                                        },
                                                                      ),
                                                                    ],
                                                                  },
                                                                ),
                                                              ],
                                                            },
                                                            e.id,
                                                          ),
                                                        ),
                                                      })
                                                    : (0, s.jsx)("div", {
                                                        className:
                                                          "p-6 text-center text-sm font-bold text-black/35",
                                                        children:
                                                          "Nessun modulo completato da mostrare.",
                                                      }),
                                                }),
                                              ],
                                            }),
                                          ],
                                        })
                                      : (0, s.jsx)("div", {
                                          className:
                                            "grid h-full place-items-center rounded-2xl border border-dashed border-black/10 p-6 text-center",
                                          children: (0, s.jsx)("p", {
                                            className:
                                              "text-sm font-bold text-black/45",
                                            children:
                                              "Nessuna scheda cliente per questo mese.",
                                          }),
                                        }),
                                ],
                              }),
                            ],
                          }),
                          (0, s.jsx)("button", {
                            type: "button",
                            onClick: () => {
                              (ev(!1), eC(!1));
                            },
                            className:
                              "absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-black/10 bg-white text-black shadow-lg xl:hidden",
                            children: (0, s.jsx)(x.A, { className: "size-5" }),
                          }),
                        ],
                      }),
                    })
                  : null,
                e$
                  ? (0, s.jsx)("div", {
                      className:
                        "fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm",
                      children: (0, s.jsxs)("div", {
                        className:
                          "max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl",
                        children: [
                          (0, s.jsxs)("div", {
                            className:
                              "flex items-start justify-between gap-4 border-b border-black/10 p-6",
                            children: [
                              (0, s.jsxs)("div", {
                                children: [
                                  (0, s.jsx)("p", {
                                    className:
                                      "text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]",
                                    children: "Modifica appuntamento",
                                  }),
                                  (0, s.jsx)("h3", {
                                    className: "text-2xl font-black",
                                    children: String(
                                      eq[F.Qm.clientName] ??
                                        "Cliente senza nome",
                                    ),
                                  }),
                                  (0, s.jsx)("p", {
                                    className:
                                      "mt-1 text-xs font-semibold text-black/40",
                                    children:
                                      "Qui puoi correggere nome cliente, pagamento e tutti i campi del modulo.",
                                  }),
                                ],
                              }),
                              (0, s.jsx)("button", {
                                type: "button",
                                onClick: () => eB(null),
                                className:
                                  "grid size-11 place-items-center rounded-full bg-black/[0.04]",
                                children: (0, s.jsx)(x.A, {
                                  className: "size-5",
                                }),
                              }),
                            ],
                          }),
                          (0, s.jsxs)("div", {
                            className: "max-h-[58vh] overflow-y-auto p-6",
                            children: [
                              (0, s.jsxs)("div", {
                                className:
                                  "mb-4 grid gap-4 rounded-[24px] border border-black/10 bg-black/[0.02] p-4 md:grid-cols-2",
                                children: [
                                  (0, s.jsxs)("label", {
                                    className: "block",
                                    children: [
                                      (0, s.jsx)("span", {
                                        className:
                                          "text-[10px] font-black uppercase tracking-[0.16em] text-black/42",
                                        children: "Nome cliente",
                                      }),
                                      (0, s.jsx)("input", {
                                        value: String(
                                          eq[F.Qm.clientName] ?? "",
                                        ),
                                        onChange: (e) =>
                                          eH((t) => ({
                                            ...t,
                                            [F.Qm.clientName]: e.target.value,
                                          })),
                                        className:
                                          "mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none",
                                        placeholder: "Nome cliente",
                                      }),
                                    ],
                                  }),
                                  (0, s.jsxs)("label", {
                                    className: "block",
                                    children: [
                                      (0, s.jsx)("span", {
                                        className:
                                          "text-[10px] font-black uppercase tracking-[0.16em] text-black/42",
                                        children: "Collaboratori",
                                      }),
                                      (0, s.jsx)("input", {
                                        value: Array.isArray(
                                          eq[F.Qm.serviceStaff],
                                        )
                                          ? eq[F.Qm.serviceStaff].join(", ")
                                          : String(eq[F.Qm.serviceStaff] ?? ""),
                                        onChange: (e) =>
                                          eH((t) => ({
                                            ...t,
                                            [F.Qm.serviceStaff]: e.target.value
                                              .split(",")
                                              .map((e) => e.trim())
                                              .filter(Boolean),
                                          })),
                                        className:
                                          "mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none",
                                        placeholder:
                                          "Collaboratori separati da virgola",
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                              (0, s.jsx)("div", {
                                className: "grid gap-4 md:grid-cols-2",
                                children: e$.form.fields.map((e) => {
                                  if (
                                    e.id === F.Qm.clientName ||
                                    e.id === F.Qm.serviceStaff
                                  )
                                    return null;
                                  let t = eq[e.id];
                                  return (0, s.jsxs)(
                                    "label",
                                    {
                                      className: (0, D.cn)(
                                        "block",
                                        "textarea" === e.type &&
                                          "md:col-span-2",
                                      ),
                                      children: [
                                        (0, s.jsx)("span", {
                                          className:
                                            "text-[10px] font-black uppercase tracking-[0.16em] text-black/42",
                                          children: e.label,
                                        }),
                                        "checkbox" === e.type
                                          ? (0, s.jsxs)("button", {
                                              type: "button",
                                              onClick: () =>
                                                eH((t) => ({
                                                  ...t,
                                                  [e.id]:
                                                    !0 !== t[e.id] &&
                                                    "true" !==
                                                      String(
                                                        t[e.id] ?? "",
                                                      ).toLowerCase(),
                                                })),
                                              className: (0, D.cn)(
                                                "mt-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold",
                                                t
                                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                  : "border-black/10 bg-white text-black/55",
                                              ),
                                              children: [
                                                (0, s.jsx)("span", {
                                                  className: (0, D.cn)(
                                                    "grid size-5 place-items-center rounded-md border",
                                                    t
                                                      ? "border-emerald-500 bg-emerald-500 text-white"
                                                      : "border-black/20",
                                                  ),
                                                  children: t
                                                    ? (0, s.jsx)(z.A, {
                                                        className: "size-3",
                                                      })
                                                    : null,
                                                }),
                                                t ? "Fatto" : "Non fatto",
                                              ],
                                            })
                                          : "select" === e.type &&
                                              e.options?.length
                                            ? (0, s.jsxs)("select", {
                                                value: String(t ?? ""),
                                                onChange: (t) =>
                                                  eH((a) => ({
                                                    ...a,
                                                    [e.id]: t.target.value,
                                                  })),
                                                className:
                                                  "mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none",
                                                children: [
                                                  (0, s.jsx)("option", {
                                                    value: "",
                                                    children: "Seleziona",
                                                  }),
                                                  e.options.map((e) =>
                                                    (0, s.jsx)(
                                                      "option",
                                                      { value: e, children: e },
                                                      e,
                                                    ),
                                                  ),
                                                ],
                                              })
                                            : "textarea" === e.type
                                              ? (0, s.jsx)("textarea", {
                                                  value: String(t ?? ""),
                                                  onChange: (t) =>
                                                    eH((a) => ({
                                                      ...a,
                                                      [e.id]: t.target.value,
                                                    })),
                                                  className:
                                                    "mt-2 min-h-28 w-full rounded-2xl border border-black/10 bg-white p-4 text-sm outline-none",
                                                })
                                              : (0, s.jsx)("input", {
                                                  value: Array.isArray(t)
                                                    ? t.join(", ")
                                                    : String(t ?? ""),
                                                  onChange: (t) => {
                                                    let a =
                                                      "worker_multi" === e.type
                                                        ? t.target.value
                                                            .split(",")
                                                            .map((e) =>
                                                              e.trim(),
                                                            )
                                                            .filter(Boolean)
                                                        : t.target.value;
                                                    eH((t) => ({
                                                      ...t,
                                                      [e.id]: a,
                                                    }));
                                                  },
                                                  className:
                                                    "mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none",
                                                }),
                                      ],
                                    },
                                    e.id,
                                  );
                                }),
                              }),
                            ],
                          }),
                          (0, s.jsxs)("div", {
                            className:
                              "flex flex-col gap-3 border-t border-black/10 p-5 sm:flex-row sm:justify-end",
                            children: [
                              (0, s.jsx)("button", {
                                type: "button",
                                onClick: () => eB(null),
                                className:
                                  "inline-flex items-center justify-center gap-2 rounded-2xl bg-black/[0.05] px-5 py-3 text-sm font-black text-black/65",
                                children: "Annulla",
                              }),
                              (0, s.jsxs)("button", {
                                type: "button",
                                onClick: tP,
                                disabled: eG,
                                className:
                                  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#EA8CCD] px-6 py-3 text-sm font-black text-white disabled:opacity-60",
                                children: [
                                  (0, s.jsx)(S.A, { className: "size-4" }),
                                  eG ? "Salvataggio..." : "Salva modifiche",
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    })
                  : null,
                (0, s.jsxs)("footer", {
                  className:
                    "relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-6 border-t border-black/10 pt-4 text-xs text-black/58 sm:text-sm",
                  children: [
                    (0, s.jsxs)("span", {
                      className: "flex items-center gap-2",
                      children: [
                        (0, s.jsx)(m.A, {
                          className: "size-4 text-[color:var(--tablet-accent)]",
                        }),
                        " Dispositivo autorizzato",
                      ],
                    }),
                    (0, s.jsxs)("div", {
                      className: "flex items-center gap-2",
                      children: [
                        (0, s.jsxs)("span", {
                          children: [
                            "Sincronizzazione: ",
                            (0, s.jsx)("strong", {
                              children: new Intl.DateTimeFormat("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }).format(ex),
                            }),
                          ],
                        }),
                        (0, s.jsx)("button", {
                          type: "button",
                          onClick: ed,
                          disabled: ei,
                          className: (0, D.cn)(
                            "flex size-7 items-center justify-center rounded-lg border border-black/10 bg-white hover:bg-black/[0.02] text-black/60 shadow-sm transition-all",
                            ei &&
                              "animate-spin text-[color:var(--tablet-accent)]",
                          ),
                          title: "Sincronizza e aggiorna appuntamenti",
                          children: (0, s.jsx)(i.A, { className: "size-3.5" }),
                        }),
                      ],
                    }),
                  ],
                }),
                ey
                  ? ((ee = (ey.customerName || "").trim().toLowerCase()),
                    (et =
                      eS?.recent?.filter((e) => {
                        let t = (e.client || "").trim().toLowerCase();
                        return t.includes(ee) || ee.includes(t);
                      }) || []),
                    (0, s.jsx)("div", {
                      className:
                        "fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm",
                      children: (0, s.jsxs)("div", {
                        className:
                          "flex flex-col max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] border border-black/10",
                        children: [
                          (0, s.jsxs)("div", {
                            className:
                              "flex items-start justify-between gap-4 border-b border-black/[0.06] p-6 bg-gradient-to-r from-pink-50/50 to-amber-50/20",
                            children: [
                              (0, s.jsxs)("div", {
                                className: "flex items-center gap-4",
                                children: [
                                  ey.customerPhotoUrl
                                    ? (0, s.jsx)("img", {
                                        src: ey.customerPhotoUrl,
                                        className:
                                          "size-14 rounded-full object-cover border-2 border-white shadow-md",
                                        alt: "",
                                      })
                                    : (0, s.jsx)("div", {
                                        className:
                                          "grid size-14 place-items-center rounded-full bg-[#ff8bb2]/15 text-[#a74758] border border-[#ff8bb2]/20 shadow-inner",
                                        children: (0, s.jsx)(y.A, {
                                          className: "size-6",
                                        }),
                                      }),
                                  (0, s.jsxs)("div", {
                                    children: [
                                      (0, s.jsxs)("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                          (0, s.jsx)("h3", {
                                            className:
                                              "text-2xl font-black text-[#171717] tracking-tight",
                                            children: ey.customerName,
                                          }),
                                          ey.isTomorrow &&
                                            (0, s.jsx)("span", {
                                              className:
                                                "inline-flex items-center gap-1 rounded bg-[#EBF9EB] border border-[#D1F2D1] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#2E7D32]",
                                              children: "Domani",
                                            }),
                                        ],
                                      }),
                                      (0, s.jsxs)("p", {
                                        className:
                                          "text-xs font-bold text-black/40 mt-0.5 flex items-center gap-1.5",
                                        children: [
                                          (0, s.jsx)(v.A, {
                                            className:
                                              "size-3.5 text-[#ff8bb2]",
                                          }),
                                          " Appuntamento alle ",
                                          ey.time,
                                        ],
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                              (0, s.jsx)("button", {
                                type: "button",
                                onClick: () => ew(null),
                                className:
                                  "grid size-10 place-items-center rounded-full bg-black/[0.04] text-black/60 hover:bg-black/[0.08] hover:text-black transition",
                                children: (0, s.jsx)(x.A, {
                                  className: "size-5",
                                }),
                              }),
                            ],
                          }),
                          (0, s.jsx)("div", {
                            className:
                              "overflow-y-auto p-6 space-y-6 flex-1 bg-white",
                            children: (0, s.jsxs)("div", {
                              className:
                                "grid grid-cols-1 md:grid-cols-2 gap-6",
                              children: [
                                (0, s.jsxs)("div", {
                                  className: "space-y-4",
                                  children: [
                                    (0, s.jsx)("h4", {
                                      className:
                                        "text-xs font-black uppercase tracking-widest text-[#ff8bb2] border-b border-[#ff8bb2]/10 pb-1.5",
                                      children: "Dettagli Appuntamento",
                                    }),
                                    (0, s.jsxs)("div", {
                                      className: "grid grid-cols-1 gap-3.5",
                                      children: [
                                        (0, s.jsxs)("div", {
                                          className: "flex items-start gap-3",
                                          children: [
                                            (0, s.jsx)("div", {
                                              className:
                                                "grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5",
                                              children: (0, s.jsx)(T.A, {
                                                className: "size-4",
                                              }),
                                            }),
                                            (0, s.jsxs)("div", {
                                              children: [
                                                (0, s.jsx)("span", {
                                                  className:
                                                    "block text-[10px] font-black uppercase tracking-wider text-black/40",
                                                  children:
                                                    "Servizio Prenotato",
                                                }),
                                                (0, s.jsx)("span", {
                                                  className:
                                                    "text-sm font-black text-black/85",
                                                  children:
                                                    ey.serviceTitle ||
                                                    "Servizio",
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                        (0, s.jsxs)("div", {
                                          className: "flex items-start gap-3",
                                          children: [
                                            (0, s.jsx)("div", {
                                              className:
                                                "grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5",
                                              children: (0, s.jsx)(b.A, {
                                                className: "size-4",
                                              }),
                                            }),
                                            (0, s.jsxs)("div", {
                                              children: [
                                                (0, s.jsx)("span", {
                                                  className:
                                                    "block text-[10px] font-black uppercase tracking-wider text-black/40",
                                                  children: "Sede",
                                                }),
                                                (0, s.jsx)("span", {
                                                  className:
                                                    "text-sm font-bold text-black/85 capitalize",
                                                  children:
                                                    "buenos-aires" ===
                                                    ey.inferredSalon
                                                      ? "Buenos Aires"
                                                      : ey.inferredSalon,
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                        (0, s.jsxs)("div", {
                                          className: "flex items-start gap-3",
                                          children: [
                                            (0, s.jsx)("div", {
                                              className:
                                                "grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5",
                                              children: (0, s.jsx)(y.A, {
                                                className: "size-4",
                                              }),
                                            }),
                                            (0, s.jsxs)("div", {
                                              className: "flex-1",
                                              children: [
                                                (0, s.jsx)("span", {
                                                  className:
                                                    "block text-[10px] font-black uppercase tracking-wider text-black/40",
                                                  children:
                                                    "Teammate Assegnati",
                                                }),
                                                (0, s.jsx)("div", {
                                                  className:
                                                    "flex flex-wrap gap-1.5 mt-1",
                                                  children:
                                                    ey.teammates &&
                                                    ey.teammates.length > 0
                                                      ? ey.teammates.map(
                                                          (e, t) =>
                                                            (0, s.jsxs)(
                                                              "div",
                                                              {
                                                                className:
                                                                  "flex items-center gap-1 bg-black/[0.03] border border-black/5 rounded-full pl-1 pr-2.5 py-0.5",
                                                                children: [
                                                                  e.photoUrl
                                                                    ? (0,
                                                                      s.jsx)(
                                                                        "img",
                                                                        {
                                                                          src: e.photoUrl,
                                                                          className:
                                                                            "size-5 rounded-full object-cover",
                                                                          alt: "",
                                                                        },
                                                                      )
                                                                    : (0,
                                                                      s.jsx)(
                                                                        "div",
                                                                        {
                                                                          className:
                                                                            "grid size-5 place-items-center rounded-full bg-[#ff8bb2]/10 text-[#a74758] text-[9px] font-black",
                                                                          children:
                                                                            e.name.charAt(
                                                                              0,
                                                                            ),
                                                                        },
                                                                      ),
                                                                  (0, s.jsx)(
                                                                    "span",
                                                                    {
                                                                      className:
                                                                        "text-[11px] font-bold text-black/75",
                                                                      children:
                                                                        e.name,
                                                                    },
                                                                  ),
                                                                ],
                                                              },
                                                              t,
                                                            ),
                                                        )
                                                      : (0, s.jsx)("span", {
                                                          className:
                                                            "text-xs text-black/35 italic font-bold",
                                                          children:
                                                            "Nessun operatore assegnato",
                                                        }),
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                        ey.bookingStr &&
                                          (0, s.jsxs)("div", {
                                            className: "flex items-start gap-3",
                                            children: [
                                              (0, s.jsx)("div", {
                                                className:
                                                  "grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5",
                                                children: (0, s.jsx)(E.A, {
                                                  className: "size-4",
                                                }),
                                              }),
                                              (0, s.jsxs)("div", {
                                                children: [
                                                  (0, s.jsx)("span", {
                                                    className:
                                                      "block text-[10px] font-black uppercase tracking-wider text-black/40",
                                                    children:
                                                      "Shopify / Booking ID",
                                                  }),
                                                  (0, s.jsx)("span", {
                                                    className:
                                                      "text-xs font-mono font-bold text-black/85 bg-black/[0.04] px-1.5 py-0.5 rounded border border-black/5",
                                                    children: ey.bookingStr,
                                                  }),
                                                ],
                                              }),
                                            ],
                                          }),
                                        null !== ey.priceAmount &&
                                          ey.priceAmount > 0 &&
                                          (0, s.jsxs)("div", {
                                            className: "flex items-start gap-3",
                                            children: [
                                              (0, s.jsx)("div", {
                                                className:
                                                  "grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100",
                                                children: (0, s.jsx)(M, {
                                                  className: "size-4",
                                                }),
                                              }),
                                              (0, s.jsxs)("div", {
                                                children: [
                                                  (0, s.jsx)("span", {
                                                    className:
                                                      "block text-[10px] font-black uppercase tracking-wider text-emerald-800",
                                                    children:
                                                      "Acconto Ricevuto",
                                                  }),
                                                  (0, s.jsx)("span", {
                                                    className:
                                                      "text-sm font-black text-emerald-700",
                                                    children:
                                                      ey.priceAmount.toLocaleString(
                                                        "it-IT",
                                                        {
                                                          style: "currency",
                                                          currency:
                                                            ey.priceCurrency,
                                                        },
                                                      ),
                                                  }),
                                                ],
                                              }),
                                            ],
                                          }),
                                        (ey.customerEmail ||
                                          ey.customerPhone) &&
                                          (0, s.jsxs)("div", {
                                            className:
                                              "mt-2 pt-2 border-t border-black/[0.05] space-y-2",
                                            children: [
                                              ey.customerEmail &&
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "flex items-center gap-2 text-xs font-semibold text-black/50 hover:text-black transition",
                                                  children: [
                                                    (0, s.jsx)(_.A, {
                                                      className:
                                                        "size-3.5 text-black/35",
                                                    }),
                                                    (0, s.jsx)("span", {
                                                      children:
                                                        ey.customerEmail,
                                                    }),
                                                  ],
                                                }),
                                              ey.customerPhone &&
                                                (0, s.jsxs)("div", {
                                                  className:
                                                    "flex items-center gap-2 text-xs font-semibold text-black/50 hover:text-black transition",
                                                  children: [
                                                    (0, s.jsx)(I.A, {
                                                      className:
                                                        "size-3.5 text-black/35",
                                                    }),
                                                    (0, s.jsx)("span", {
                                                      children:
                                                        ey.customerPhone,
                                                    }),
                                                  ],
                                                }),
                                            ],
                                          }),
                                        ey.notes &&
                                          (0, s.jsxs)("div", {
                                            className:
                                              "mt-2 bg-amber-50/40 border border-amber-100/60 rounded-xl p-3.5 text-xs text-amber-900/80",
                                            children: [
                                              (0, s.jsx)("span", {
                                                className:
                                                  "block font-black uppercase tracking-wider text-[9px] text-amber-800/60 mb-1",
                                                children: "Note Prenotazione",
                                              }),
                                              (0, s.jsx)("p", {
                                                className:
                                                  "font-semibold leading-relaxed whitespace-pre-wrap",
                                                children: ey.notes,
                                              }),
                                            ],
                                          }),
                                      ],
                                    }),
                                  ],
                                }),
                                (0, s.jsxs)("div", {
                                  className: "space-y-4",
                                  children: [
                                    (0, s.jsx)("h4", {
                                      className:
                                        "text-xs font-black uppercase tracking-widest text-[#ff8bb2] border-b border-[#ff8bb2]/10 pb-1.5",
                                      children: "Cronologia Controlli Cliente",
                                    }),
                                    (0, s.jsx)("div", {
                                      className: "space-y-3",
                                      children:
                                        et.length > 0
                                          ? et.map((e) => {
                                              let t = new Intl.DateTimeFormat(
                                                  "it-IT",
                                                  {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    timeZone: "Europe/Rome",
                                                  },
                                                ).format(new Date(e.createdAt)),
                                                a = "";
                                              return (
                                                (a =
                                                  "OK" === e.correctness
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                    : e.correctness
                                                          .toLowerCase()
                                                          .includes("errore")
                                                      ? "bg-rose-50 text-rose-700 border-rose-100"
                                                      : "bg-amber-50 text-amber-700 border-amber-100"),
                                                (0, s.jsxs)(
                                                  "button",
                                                  {
                                                    type: "button",
                                                    onClick: () => {
                                                      (ew(null), tD(e.id));
                                                    },
                                                    className:
                                                      "w-full text-left p-3.5 rounded-2xl border border-black/[0.06] hover:bg-black/[0.01] hover:border-black/15 transition-all duration-200 group flex items-start justify-between gap-3 bg-white hover:shadow-sm",
                                                    children: [
                                                      (0, s.jsxs)("div", {
                                                        className: "space-y-1",
                                                        children: [
                                                          (0, s.jsxs)("div", {
                                                            className:
                                                              "flex items-center gap-1.5",
                                                            children: [
                                                              (0, s.jsx)(N.A, {
                                                                className:
                                                                  "size-3.5 text-black/35",
                                                              }),
                                                              (0, s.jsx)(
                                                                "span",
                                                                {
                                                                  className:
                                                                    "text-xs font-black text-black/75",
                                                                  children: t,
                                                                },
                                                              ),
                                                            ],
                                                          }),
                                                          (0, s.jsxs)("p", {
                                                            className:
                                                              "text-[11px] font-semibold text-black/40",
                                                            children: [
                                                              "Gestito da: ",
                                                              (0, s.jsx)(
                                                                "span",
                                                                {
                                                                  className:
                                                                    "font-bold text-black/60",
                                                                  children:
                                                                    e.staff.join(
                                                                      ", ",
                                                                    ) ||
                                                                    "Nessuno",
                                                                },
                                                              ),
                                                            ],
                                                          }),
                                                          (0, s.jsxs)("div", {
                                                            className:
                                                              "flex flex-wrap gap-1.5 mt-1.5",
                                                            children: [
                                                              (0, s.jsxs)(
                                                                "span",
                                                                {
                                                                  className:
                                                                    "text-[9px] font-black uppercase tracking-wider text-black/35 bg-black/[0.03] px-1.5 py-0.5 rounded",
                                                                  children: [
                                                                    "Sede: ",
                                                                    "buenos-aires" ===
                                                                    e.salon
                                                                      ? "Buenos Aires"
                                                                      : e.salon,
                                                                  ],
                                                                },
                                                              ),
                                                              e.deposit > 0 &&
                                                                (0, s.jsxs)(
                                                                  "span",
                                                                  {
                                                                    className:
                                                                      "text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50/50 px-1.5 py-0.5 rounded",
                                                                    children: [
                                                                      "Acc: €",
                                                                      e.deposit,
                                                                    ],
                                                                  },
                                                                ),
                                                            ],
                                                          }),
                                                        ],
                                                      }),
                                                      (0, s.jsxs)("div", {
                                                        className:
                                                          "flex flex-col items-end gap-1.5 shrink-0",
                                                        children: [
                                                          (0, s.jsx)("span", {
                                                            className: `text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${a}`,
                                                            children:
                                                              e.correctness,
                                                          }),
                                                          (0, s.jsxs)("span", {
                                                            className:
                                                              "text-[9px] font-bold text-[#ff8bb2] group-hover:underline flex items-center gap-0.5",
                                                            children: [
                                                              "Vedi/Modifica ",
                                                              (0, s.jsx)(A.A, {
                                                                className:
                                                                  "size-3",
                                                              }),
                                                            ],
                                                          }),
                                                        ],
                                                      }),
                                                    ],
                                                  },
                                                  e.id,
                                                )
                                              );
                                            })
                                          : (0, s.jsxs)("div", {
                                              className:
                                                "flex flex-col items-center justify-center py-8 text-center text-xs font-bold text-black/35 gap-2 border border-dashed border-black/10 rounded-2xl",
                                              children: [
                                                (0, s.jsx)(p.A, {
                                                  className:
                                                    "size-6 text-black/15",
                                                }),
                                                (0, s.jsx)("span", {
                                                  children:
                                                    "Nessun controllo compilato questo mese.",
                                                }),
                                              ],
                                            }),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          }),
                          (0, s.jsxs)("div", {
                            className:
                              "border-t border-black/[0.06] p-6 bg-black/[0.01] flex flex-wrap items-center justify-between gap-4",
                            children: [
                              (0, s.jsx)("button", {
                                type: "button",
                                onClick: () => ew(null),
                                className:
                                  "px-5 py-2.5 rounded-xl border border-black/10 hover:bg-black/[0.02] text-xs font-black uppercase tracking-wider text-black/60 transition active:scale-95",
                                children: "Chiudi",
                              }),
                              (0, s.jsx)("div", {
                                className: "flex items-center gap-3",
                                children: (0, s.jsxs)("button", {
                                  type: "button",
                                  onClick: () => {
                                    (ew(null), tV(ey));
                                  },
                                  className:
                                    "inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff8bb2] to-[#a74758] text-white text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 shadow-md hover:shadow-lg transition duration-200",
                                  children: [
                                    (0, s.jsx)(u.A, { className: "size-4" }),
                                    "Compila Scheda Controllo",
                                  ],
                                }),
                              }),
                            ],
                          }),
                        ],
                      }),
                    }))
                  : null,
                tZ,
              ],
            }),
          });
    }
  },
};
export default module_def;
