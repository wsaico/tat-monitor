'use client';

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Metadata, Viewport } from "next";
import { useTATLogic, AL, isValidTime, pad2, fmt, sub, fmtMSS } from '@/hooks/useTATLogic';

/* ─── ICONS (Ported from TATCalculator.jsx) ─────────────────────── */
const Ic = {
  plane: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 1 16.5 2.5L13 6 4.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 5.5 5.3c.4.4.9.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
  lock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  eye: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  share: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  reset: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
  cam: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  logout: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  ok: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  warn: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  heart: <svg width="11" height="11" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  edit: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
};
/* ─── NOTIFICATION UTILS ────────────────────────────────────────── */
async function setupNotifications() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return true;
  } catch (e) {
    console.warn("SW no disponible:", e);
    return false;
  }
}

async function scheduleAlerts(alerts: any[]) {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "SCHEDULE_ALERTS", alerts });
  } catch (e) { }
}

async function clearAlerts() {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "CLEAR_ALERTS" });
  } catch (e) { }
}

const hhmm2ts = (hhmm: string) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/* ─── TEXT TIME INPUT Component (Ported) ────────────────────────── */
function TI({ value, onChange, color = "#fff", size = 22 }: any) {
  const [raw, setRaw] = useState(value || "");
  const [focused, setFocused] = useState(false);

  const handleChange = (e: any) => {
    let v = e.target.value.replace(/[^0-9:]/g, "");
    if (v.length === 2 && !v.includes(":") && raw.replace(/:/g, "").length < 2) v += ":";
    if (v.length > 5) return;
    setRaw(v);
    if (isValidTime(v)) onChange(`${pad2(+v.split(":")[0])}:${pad2(+v.split(":")[1])}`);
  };
  const handleFocus = (e: any) => { setRaw(value || ""); setFocused(true); setTimeout(() => e.target.select(), 10); };
  const handleBlur = () => {
    setFocused(false);
    const c = (raw || "").replace(/[^0-9]/g, "");
    if (c.length === 4) { const h = +c.slice(0, 2), m = +c.slice(2, 4); if (h < 24 && m < 60) { const f = `${pad2(h)}:${pad2(m)}`; onChange(f); setRaw(f); return; } }
    setRaw(value || "");
  };

  return (
    <input
      type="text" inputMode="numeric"
      placeholder="--:--"
      value={focused ? raw : (value || "")}
      onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur}
      onKeyDown={e => e.key === "Enter" && (e.target as any).blur()}
      maxLength={5}
      style={{
        background: "transparent", border: "none", outline: "none",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        fontSize: size, fontWeight: 800, color,
        width: "100%", textAlign: "center", letterSpacing: "1px",
        fontVariantNumeric: "tabular-nums", caretColor: color, padding: 0,
      } as any}
    />
  );
}

/* ─── CALCULATOR Component (Converted to FC) ───────────────────── */
function Calc({ airlineKey, onLogout }: { airlineKey: string, onLogout: () => void }) {
  const {
    etdItin, setEtdItin,
    cmReal, setCmReal,
    cmPlan, cmDelta,
    rows, resetData, al,
    alertAt, setAlertAt, dark, setDark,
    flightNum, setFlightNum,
    groundTime, deliveryCountdown,
    tigSeconds, pbSeconds,
    deliveryTarget, setDeliveryTarget
  } = useTATLogic(airlineKey);

  const [view, setView] = useState<"calc" | "hist">("calc");
  const [notifOk, setNotifOk] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [ov, setOv] = useState<string | null>(null);
  const capRef = useRef<HTMLDivElement>(null);

  // Setup notificaciones al montar
  useEffect(() => {
    setupNotifications().then(ok => setNotifOk(ok));
  }, []);

  // Programar alertas via Service Worker
  useEffect(() => {
    if (!notifOk || !al) return;
    const entRow = rows.find(r => r.isEnt);
    const pbRow = rows.find(r => r.isPb);
    if (!entRow || !pbRow) return;

    const flightLabel = `${al?.code || ""} | ${al?.name || ""}`;
    const alerts = [
      {
        id: "pre-pb",
        title: `🚀 ${alertAt} min para Push Back`,
        body: `${flightLabel} — PB a las ${pbRow.real}.`,
        fireAt: hhmm2ts(pbRow.real) - alertAt * 60 * 1000,
        tag: "tat-pre-pb",
      },
      {
        id: "ent",
        title: `📋 ¡Hora de entregar el vuelo!`,
        body: `${flightLabel} — Entrega a las ${entRow.real}.`,
        fireAt: hhmm2ts(entRow.real),
        tag: "tat-ent",
      },
      {
        id: "pb",
        title: `🛫 Push Back — ${pbRow.real}`,
        body: `${flightLabel} — ETD: ${etdItin}.`,
        fireAt: hhmm2ts(pbRow.real),
        tag: "tat-pb",
      },
    ].filter(a => a.fireAt > Date.now());

    scheduleAlerts(alerts);
    return () => { clearAlerts(); };
  }, [notifOk, al, rows, alertAt, etdItin]);

  const loadH2C = () => new Promise<void>((res, rej) => {
    if ((window as any).html2canvas) return res();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => res(); s.onerror = rej; document.head.appendChild(s);
  });

  const capture = useCallback(async () => {
    try {
      await loadH2C();
      const c = await (window as any).html2canvas(capRef.current, { backgroundColor: "#F4F6F9", scale: 2.5, useCORS: true, logging: false });
      setOv(c.toDataURL("image/png"));
    }
    catch (e) { console.error(e); }
  }, []);

  const doShare = useCallback(async () => {
    if (!ov) return;
    try {
      const b = await (await fetch(ov)).blob();
      const f = new File([b], "TAT.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: `TAT ${airlineKey}` }); return; }
    }
    catch (_) { }
    const a = document.createElement("a");
    a.href = ov;
    a.download = `TAT_${airlineKey}.png`;
    a.click();
  }, [ov, airlineKey]);

  const [history, setHistory] = useState<any[]>([]);
  const [savedFlights, setSavedFlights] = useState<any[]>([]);

  // Load history and saved flights on mount
  useEffect(() => {
    const sh = localStorage.getItem(`tat_hist_${airlineKey}`);
    if (sh) try { setHistory(JSON.parse(sh)); } catch (e) { }
    const sf = localStorage.getItem(`tat_saved_flights_${airlineKey}`);
    if (sf) try { setSavedFlights(JSON.parse(sf)); } catch (e) { }
  }, [airlineKey]);

  const saveFlight = useCallback(() => {
    if (!flightNum || !etdItin) return;
    const newSaved = [{ flight: flightNum.toUpperCase(), etd: etdItin }, ...savedFlights.filter(f => f.flight !== flightNum.toUpperCase())].slice(0, 10);
    setSavedFlights(newSaved);
    localStorage.setItem(`tat_saved_flights_${airlineKey}`, JSON.stringify(newSaved));
  }, [flightNum, etdItin, savedFlights, airlineKey]);

  const saveToHistory = useCallback(() => {
    const entRow = rows.find(r => r.isEnt);
    const pbRow = rows.find(r => r.isPb);
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("es-PE"),
      time: new Date().toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit' }),
      airline: airlineKey,
      flightNum,
      etd: etdItin,
      cmPlan,
      cmReal,
      pbPlan: pbRow?.plan || "--:--",
      pbReal: pbRow?.real || "--:--",
      delta: cmDelta,
    };
    const updated = [newEntry, ...history].slice(0, 30);
    setHistory(updated);
    localStorage.setItem(`tat_hist_${airlineKey}`, JSON.stringify(updated));
    saveFlight();
  }, [airlineKey, etdItin, cmPlan, cmReal, cmDelta, rows, history, flightNum, saveFlight]);

  const exportPDF = () => {
    if (!al) return;
    const lates = history.filter(h => h.delta > 0).length;
    const ontime = history.filter(h => h.delta <= 0).length;
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte TAT — ${al.name}</title>
      <style>body{font-family:sans-serif;padding:32px;color:#1E293B;}h1{font-size:22px;}table{width:100%;border-collapse:collapse;}th{background:#F1F5F9;padding:8px;text-align:left;}td{padding:8px;border-bottom:1px solid #F1F5F9;}</style>
      </head><body>
      <h1>✈️ Reporte de Turno — ${al.name}</h1>
      <p>A tiempo: ${ontime} | Demorados: ${lates}</p>
      <table><thead><tr><th>Fecha</th><th>ETD</th><th>CM Real</th><th>Estado</th></tr></thead>
      <tbody>${history.map(h => `<tr><td>${h.date} ${h.time}</td><td>${h.etd}</td><td>${h.cmReal}</td><td>${h.delta > 0 ? `+${fmt(h.delta)}` : 'OK'}</td></tr>`).join("")}</tbody>
      </table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const isEarly = cmDelta < 0;
  const isExact = cmDelta === 0;

  const entRow = rows.find(r => r.isEnt);
  const pbRow = rows.find(r => r.isPb);

  const buildWA = useCallback(() => {
    if (!al) return "";
    const status = isEarly ? `✅ ADELANTADO ${fmt(-cmDelta)}` : cmDelta > 0 ? `⚠️ DEMORADO +${fmt(cmDelta)}` : `✅ EN TIEMPO`;
    return [
      `✈️ *${al.code} ${flightNum} | TAT Calculator*`,
      `📅 ${new Date().toLocaleDateString("es-PE")} ${new Date().toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit' })}`,
      ``,
      `🕐 ETD Itinerario: *${etdItin}*`,
      `🛬 CM Real: *${cmReal}* (TIG: ${groundTime} min)`,
      `📋 Entrega vuelo: *${entRow?.real || "--:--"}* (Plan: ${entRow?.plan || "--:--"})`,
      `🚀 Push Back: *${pbRow?.real || "--:--"}* (Plan: ${pbRow?.plan || "--:--"})`,
      ``,
      status,
      `_TAT Monitor Pro_`,
    ].join("\n");
  }, [al, etdItin, cmReal, groundTime, entRow?.plan, entRow?.real, pbRow?.plan, pbRow?.real, isEarly, cmDelta, flightNum]);

  const sendWA = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildWA())}`, "_blank");

  if (!al) return null;
  const th = al.theme;

  const msgData = (() => {
    if (!pbRow || !entRow) return { type: "ok", msg: "" };
    if (isExact) return {
      type: "ok",
      msg: `Vuelo puntual. Objetivo: Cumplir hitos para Entrega a las ${entRow.real} y Push back ${pbRow.real}.`,
    };
    if (isEarly) return {
      type: "ok",
      msg: `Avión adelantado ${fmt(-cmDelta)}. ¡No esperes al ETD! Objetivo: Entrega anticipada ${entRow.real} y Push back a las ${pbRow.real}.`,
    };
    return {
      type: "late",
      msg: `Llegada tardía (+${fmt(cmDelta)}). Foco en recuperación: Entrega límite ${entRow.plan} para Push back a las ${pbRow.real}.`,
    };
  })();

  const SC = msgData.type === "ok" ? "#4ADE80" : "#EF4444";
  const SBg = msgData.type === "ok" ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)";
  const SBr = msgData.type === "ok" ? "rgba(74,222,128,0.22)" : "rgba(239,68,68,0.22)";

  if (view === "hist") return (
    <div className={`A ${dark ? 'A--dark' : ''}`}>
      <nav className="N" style={{ background: th.nav }}>
        <div className="N-l">
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 20 }} onClick={() => setView("calc")}>←</button>
          <span className="N-nm">Historial del turno</span>
        </div>
        <div className="N-r">
          <button className="N-out" onClick={exportPDF} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', fontSize: 10, borderRadius: 6, fontWeight: 800 }}>PDF</button>
        </div>
      </nav>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {history.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>No hay vuelos registrados</div>}
        {history.map(h => (
          <div key={h.id} className="HIST-card" style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{h.airline}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: h.delta > 0 ? "#EF4444" : "#4ADE80" }}>{h.delta > 0 ? `+${fmt(h.delta)}` : "OK"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div><div style={{ fontSize: 8, color: "#94A3B8" }}>ETD</div><div style={{ fontSize: 12, fontWeight: 800 }}>{h.etd}</div></div>
              <div><div style={{ fontSize: 8, color: "#94A3B8" }}>CM</div><div style={{ fontSize: 12, fontWeight: 800 }}>{h.cmReal}</div></div>
              <div><div style={{ fontSize: 8, color: "#94A3B8" }}>PB</div><div style={{ fontSize: 12, fontWeight: 800 }}>{h.pbReal}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`A ${dark ? 'A--dark' : ''}`}>
      {/* NAV */}
      <nav className="N" style={{ background: th.nav }}>
        <div className="N-l">
          <span style={{ color: th.accent, display: "flex" }}>{Ic.plane}</span>
          <span className="N-nm">TAT Calculator</span>
        </div>
        <div className="N-r">
          <button className="N-out" onClick={() => setDark(!dark)} style={{ color: dark ? "#FACC15" : "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)" }}>
            {dark ? Ic.sun : Ic.moon}
          </button>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0 10px", height: 32 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: th.accent, marginRight: 6, opacity: 0.8 }}>FLT</span>
            <input
              value={flightNum}
              onChange={e => setFlightNum(e.target.value.toUpperCase())}
              placeholder="----"
              style={{ background: "none", border: "none", color: "#fff", width: 45, fontSize: 13, fontWeight: 800, outline: "none", textAlign: "left" }}
            />
          </div>
          <button className="N-out" onClick={() => setShowCfg(true)} style={{ color: th.accent, background: "rgba(255,255,255,0.08)" }}>{Ic.edit}</button>
          <button className="N-out" onClick={() => setView("hist")} style={{ background: "rgba(255,255,255,0.08)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </button>
          <button className="N-out" onClick={onLogout} style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{Ic.logout}</button>
        </div>
      </nav>

      {/* CONFIG MODAL */}
      {showCfg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="CFG-modal" style={{ background: "#fff", width: "100%", maxWidth: 320, borderRadius: 20, padding: 24, position: "relative" }}>
            <button onClick={() => setShowCfg(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", fontSize: 18, color: "#94A3B8" }}>✕</button>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Configuración</h3>

            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Aviso previo Pushback</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 24 }}>
              {[3, 5, 10, 15].map(m => (
                <button key={m} onClick={() => setAlertAt(m)} className={`CFG-btn ${alertAt === m ? "CFG-btn--act" : ""}`} style={{ padding: "8px 0", borderRadius: 10, border: `1.5px solid ${alertAt === m ? th.accent : "#E2E8F0"}`, background: alertAt === m ? `${th.accent}12` : "none", color: alertAt === m ? th.accent : "#64748B", fontWeight: 700, fontSize: 12 }}>{m}m</button>
              ))}
            </div>

            {savedFlights.length > 0 && (
              <>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Vuelos Recientes</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {savedFlights.map((f, i) => (
                    <button key={i} onClick={() => { setFlightNum(f.flight); setEtdItin(f.etd); setShowCfg(false); }} style={{ background: "rgba(0,0,0,0.05)", border: "none", padding: "8px", borderRadius: 8, textAlign: "left" }}>
                      <div style={{ fontSize: 10, fontWeight: 800 }}>{f.flight}</div>
                      <div style={{ fontSize: 9, color: "#64748B" }}>ETD: {f.etd}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginTop: 24, padding: 12, background: notifOk ? "#F0FDF4" : "#FEF2F2", borderRadius: 12, border: "1px solid", borderColor: notifOk ? "#BBF7D0" : "#FECACA" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: notifOk ? "#166534" : "#991B1B" }}>{notifOk ? "Notificaciones Activas" : "Notificaciones Desactivadas"}</div>
              {!notifOk && <button onClick={() => setupNotifications().then(ok => setNotifOk(ok))} style={{ marginTop: 6, width: "100%", padding: "6px 0", borderRadius: 8, background: "#EF4444", color: "#fff", border: "none", fontWeight: 700, fontSize: 10 }}>Habilitar</button>}
            </div>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className="H" style={{ background: `linear-gradient(160deg,${th.gradA},${th.gradB})` }}>
        <div className="H-msg" style={{ background: SBg, border: `1px solid ${SBr}`, color: SC }}>
          <span style={{ display: "flex", flexShrink: 0 }}>{msgData.type === "ok" ? Ic.ok : Ic.warn}</span>
          <span className="H-msg-t">{msgData.msg}</span>
        </div>

        {/* TOP INPUTS ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div className="H-inp-card H-inp-card--secondary" style={{ borderColor: "rgba(255,255,255,0.15)", padding: "10px 8px" }} onClick={() => (document.querySelector('.h-etd-in input') as any)?.focus()}>
            <div className="H-inp-top"><span className="H-inp-lbl" style={{ fontSize: 7 }}>ETD Itinerario</span></div>
            <div className="h-etd-in"><TI value={etdItin} onChange={setEtdItin} color={th.accent} size={18} /></div>
          </div>
          <div className="H-inp-card H-inp-card--secondary" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)", padding: "10px 8px" }} onClick={() => (document.querySelector('.h-cm-in input') as any)?.focus()}>
            <div className="H-inp-top"><span className="H-inp-lbl" style={{ fontSize: 7, color: "#fff" }}>CM REAL Operativo</span></div>
            <div className="h-cm-in"><TI value={cmReal} onChange={setCmReal} color="#fff" size={18} /></div>
          </div>
        </div>

        {/* OPERATION COCKPIT */}
        <div style={{
          background: "rgba(0,0,0,0.25)",
          borderRadius: 20,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 12,
          alignItems: "center"
        }}>
          {/* L: Priority Counter */}
          <div style={{ borderRight: "1px solid rgba(255,255,255,0.1)", paddingRight: 12 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: (pbSeconds !== null && pbSeconds < 0) ? '#FF4D4D' : th.accent, letterSpacing: 1.5 }}>
                {al?.code === 'LATAM' ? 'GANTT P/ PUSHBACK' : 'P/ PUSHBACK'}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: (pbSeconds !== null && Math.abs(pbSeconds) >= 6000) ? 32 : 44, fontWeight: 900, color: (pbSeconds !== null && pbSeconds < 0) ? '#FF4D4D' : "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {pbSeconds !== null
                  ? (al?.code === 'LATAM' ? fmtMSS(-pbSeconds, true) : fmtMSS(pbSeconds))
                  : '--:--'}
              </span>
            </div>
            {(pbSeconds !== null && pbSeconds < 0) && (
              <div style={{ background: "#FF4D4D", color: "#fff", fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 4 }}>DELAY</div>
            )}

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, opacity: 0.8 }}>
              <span style={{ fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>T. EN TIERRA:</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmtMSS(tigSeconds)}</span>
            </div>
          </div>

          {/* R: Milestones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>PROY. ENTREGA</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{entRow?.real || '--:--'}</div>
            </div>
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.05)" }} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>PROY. PUSHBACK</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{pbRow?.real || '--:--'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE HEADER */}
      <div className="TH" style={{ marginTop: 10 }}>
        <span>HITOS OPERATIVOS</span>
        <span style={{ textAlign: "center", color: th.accent }}>PROYECCIÓN</span>
        <span style={{ textAlign: "center" }} className="TH-dim">ITINERARIO</span>
        <span style={{ textAlign: "center" }}>{al?.code === 'LATAM' ? 'GANTT' : 'DIF'}</span>
      </div>

      {/* ROWS */}
      <div className="ML">
        {rows.map((r, i) => {
          const late = r.diff > 0;
          const early = r.diff < 0;
          const exact = r.diff === 0;
          const dc = late ? "#EF4444" : early ? "#4ADE80" : "#94A3B8";
          const ds = exact ? "00:00" : late ? `+${fmt(r.diff)}` : `−${fmt(-r.diff)}`;
          return (
            <div key={i} className={`MR${r.isEnt ? " MR-ent" : r.isPb ? " MR-pb" : late ? " MR-late" : early ? " MR-ok" : ""}`}
              style={{ animationDelay: `${i * 10}ms` } as any}>
              <div className="MR-lbl-wrap">
                {(r.isEnt || r.isPb) && <span className="MR-dot" style={{ background: th.accent }} />}
                {(!r.isEnt && !r.isPb) && <span className="MR-dot" style={{ background: late ? "#EF4444" : early ? "#4ADE80" : "#CBD5E1" }} />}
                <span className="MR-lbl">{r.label}</span>
              </div>
              <span className="MR-t" style={{ color: late ? "#EF4444" : early ? "#15803D" : "#1E293B", fontWeight: 800 }}>{r.real}</span>
              <span className="MR-t MR-t--dim">{r.plan}</span>
              <span className="MR-t" style={{ color: al?.code === 'LATAM' ? '#94A3B8' : dc, fontWeight: 700 }}>{al?.code === 'LATAM' ? (r as any).gantt : ds}</span>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <footer className="F">
        hecho con {Ic.heart} por&nbsp;
        <a href="https://wsaico.com" target="_blank" rel="noopener noreferrer">wsaico</a>
      </footer>

      {/* BOTTOM */}
      <div className="B" style={{ padding: "10px 16px 30px" }}>
        <button className="B-btn" onClick={resetData} style={{ flex: 1 }}>
          <div style={{ background: "rgba(148,163,184,0.1)", padding: 10, borderRadius: 12, marginBottom: 4 }}>{Ic.reset}</div>
          <span>Reiniciar</span>
        </button>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "0 20px" }}>
          <button className="B-fab" style={{ background: `linear-gradient(135deg,${th.gradA},${th.gradB})`, width: 64, height: 64, marginTop: -24, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)" }} onClick={() => { saveToHistory(); capture(); }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
          </button>
        </div>
        <button className="B-btn" style={{ color: th.accent, flex: 1 }} onClick={sendWA}>
          <div style={{ background: `${th.accent}15`, padding: 10, borderRadius: 12, marginBottom: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 0 0 0-3.48-8.413Z" /></svg>
          </div>
          <span>WhatsApp</span>
        </button>
      </div>

      {/* CAPTURE MASK */}
      <div id="cap" ref={capRef}>
        <div style={{ background: `linear-gradient(160deg,${th.gradA},${th.gradB})`, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>{al.name} {flightNum} · TAT Calculator</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {new Date().toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
              </div>
            </div>
            <div style={{ background: SBg, border: `1px solid ${SBr}`, borderRadius: 20, padding: "4px 10px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 8.5, fontWeight: 700, color: SC, maxWidth: 170, textAlign: "right" }}>{msgData.msg}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {entRow && (
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 4px", textAlign: "center", border: `1px solid ${th.accent}30` }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 7, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: th.accent, marginBottom: 4 }}>PROY. ENTREGA</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 900, color: th.accent }}>{entRow.real || '--:--'}</div>
              </div>
            )}
            {pbRow && (
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 4px", textAlign: "center", border: `1px solid ${SC}30` }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 7, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: SC, marginBottom: 4 }}>PROY. PUSHBACK</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 900, color: SC }}>{pbRow.real || '--:--'}</div>
              </div>
            )}
          </div>
        </div>
        <div style={{ background: "#F4F6F9", padding: "10px 12px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 65px 60px 45px", gap: 4, padding: "0 6px 4px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "7px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#94A3B8" }}>
            <span>HITO</span><span style={{ textAlign: "center" }}>PROYEC.</span><span style={{ textAlign: "center", opacity: 0.5 }}>ITIN.</span><span style={{ textAlign: "center" }}>{al?.code === 'LATAM' ? 'GANTT' : 'DIF'}</span>
          </div>
          {rows.map((r, i) => {
            const late = r.diff > 0, early = r.diff < 0;
            const dc = late ? "#EF4444" : early ? "#22C55E" : "#94A3B8";
            const ds = r.diff === 0 ? "00:00" : late ? `+${fmt(r.diff)}` : `−${fmt(-r.diff)}`;
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 65px 60px 45px", gap: 4, alignItems: "center", background: (r.isEnt || r.isPb) ? "#EEF2FF" : "#fff", borderRadius: 6, borderLeft: `3px solid ${r.isEnt ? th.accent : r.isPb ? "#818CF8" : late ? "#EF4444" : early ? "#4ADE80" : "#E2E8F0"}`, padding: "5px 7px", marginBottom: 3 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 9.5, fontWeight: 600, color: "#334155" }}>{r.label}</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 800, color: late ? "#EF4444" : early ? "#15803D" : "#1E293B", textAlign: "center" }}>{r.real}</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 10, fontWeight: 600, color: "#94A3B8", textAlign: "center", opacity: 0.6 }}>{r.plan}</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: al?.code === 'LATAM' ? '#94A3B8' : dc, textAlign: "center" }}>{al?.code === 'LATAM' ? (r as any).gantt : ds}</span>
              </div>
            );
          })}
          <div style={{ textAlign: "right", marginTop: 6, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 7.5, color: "#94A3B8" }}>wsaico.com</div>
        </div>
      </div>

      {/* OVERLAY for shared image */}
      {ov && (
        <div className="OV" onClick={() => setOv(null)}>
          <img src={ov} className="OV-img" unselectable="on" alt="Comprobante TAT" />
          <div className="OV-row" onClick={e => e.stopPropagation()}>
            <button className="OV-shr" style={{ background: th.accent, color: "#052E16" }} onClick={doShare}>{Ic.share} Compartir</button>
            <button className="OV-cls" onClick={() => setOv(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── LOGIN Component (Minimalist Redesign) ───────────────────── */
function Login({ onLogin }: { onLogin: (ak: string) => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    setTimeout(() => {
      const p = pass.toUpperCase().trim();
      if (AL[p]) onLogin(p); else setErr("Código inválido");
      setBusy(false);
    }, 800);
  };

  return (
    <div className="L">
      <div className="L-grid" /><div className="L-g1" /><div className="L-g2" />

      <div className="L-wrap" style={{ maxWidth: 450, margin: '0 auto' }}>
        <div className="L-mid">
          <h1 className="L-h1">TAT<br />Monitor</h1>
          <div style={{ height: 40 }} />
          <div className={`L-f${err ? " L-fe" : ""}`}>
            <input
              type="password"
              className="L-in"
              placeholder="Introduce el código"
              value={pass}
              onChange={e => { setPass(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && go()}
              autoCapitalize="characters"
              autoComplete="off"
              style={{ textAlign: 'center', padding: '18px 20px' }}
            />
          </div>
          {err && <p className="L-er">{err}</p>}
          <button className="L-bt" onClick={go} disabled={busy || !pass.trim()}>
            {busy ? <span className="L-sp" /> : <span>Acceder</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP PAGE (Resilient Initialization) ────────────────── */
export default function Home() {
  const [ak, setAk] = useState<string | null>(null);
  const [m, setM] = useState(false);

  useEffect(() => {
    setM(true);
    try {
      const saved = localStorage.getItem('tat_calc_v2_ak');
      if (saved && AL[saved]) setAk(saved);
    } catch (e) { }
  }, []);

  useEffect(() => {
    if (!m) return;
    try {
      if (ak) localStorage.setItem('tat_calc_v2_ak', ak);
      else localStorage.removeItem('tat_calc_v2_ak');
    } catch (e) { }
  }, [ak, m]);

  // Fallback visible para evitar confusión de "pantalla blanca"
  if (!m) {
    return (
      <div style={{ background: '#060A12', height: '100dvh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="L-sp" />
      </div>
    );
  }

  return (
    <div id="root" suppressHydrationWarning>
      {ak && AL[ak] ? (
        <Calc airlineKey={ak} onLogout={() => setAk(null)} />
      ) : (
        <Login onLogin={setAk} />
      )}
    </div>
  );
}
