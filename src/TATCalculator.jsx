import { useState, useRef, useCallback, useEffect } from "react";

/* ─── TIME UTILS ─────────────────────────────────────────────────── */
const toMins = t => { const [h, m] = (t || "00:00").split(":").map(Number); return h * 60 + (m || 0); };
const addMins = (t, d) => { const v = ((toMins(t) + d) % 1440 + 1440) % 1440; return `${p2(Math.floor(v / 60))}:${p2(v % 60)}`; };
const subT = (a, b) => toMins(b) - toMins(a);
const p2 = n => String(n).padStart(2, "0");
const fmt = m => { const a = Math.abs(m); return `${p2(Math.floor(a / 60))}:${p2(a % 60)}`; };
const fmtDur = m => { const a = Math.abs(m); const h = Math.floor(a / 60); const mins = a % 60; return h > 0 ? `${h}h ${p2(mins)} min` : `${mins} min`; };
const isValid = t => /^\d{2}:\d{2}$/.test(t) && +t.split(":")[0] < 24 && +t.split(":")[1] < 60;
const nowHHMM = () => { const n = new Date(); return `${p2(n.getHours())}:${p2(n.getMinutes())}`; };
const nowSecs = () => { const n = new Date(); return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(); };
const isNight = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

// Convierte HH:MM de hoy a timestamp ms
const hhmm2ts = hhmm => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/* ─── AVIATION AUDIO CHIME & HAPTICS (Web Audio API) ───────────── */
function playAviationChime(type = "chime") {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    if (type === "chime") {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(852, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.22);
      gain2.gain.setValueAtTime(0.12, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc2.connect(gain2); gain2.connect(ctx.destination);

      osc1.start(now); osc1.stop(now + 0.5);
      osc2.start(now + 0.22); osc2.stop(now + 0.8);
    } else if (type === "alert") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === "tap") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.09);
    }
  } catch (_) {}
}

const triggerFeedback = (type = "chime") => {
  playAviationChime(type);
  if (navigator.vibrate) {
    if (type === "alert") navigator.vibrate([120, 60, 120]);
    else if (type === "tap") navigator.vibrate(25);
    else navigator.vibrate(45);
  }
};

/* ─── SCREEN WAKE LOCK (Pantalla siempre activa en rampa) ────────── */
function useWakeLock() {
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef(null);

  const requestLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener("release", () => setWakeLockActive(false));
      } catch (err) {
        console.warn("WakeLock error:", err);
      }
    }
  };

  const releaseLock = async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch (_) {}
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  };

  const toggleWakeLock = () => {
    triggerFeedback("tap");
    if (wakeLockActive) releaseLock();
    else requestLock();
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && wakeLockActive) requestLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, [wakeLockActive]);

  return { wakeLockActive, toggleWakeLock };
}

/* ─── FASES OPERATIVAS DEL TURNAROUND ───────────────────────────── */
function getTatPhase(minsSinceCm, totalTat) {
  if (minsSinceCm < 0) return { name: "Por Llegar / Calzos", color: "#94A3B8", pct: 0 };
  const pct = Math.min(100, Math.max(0, Math.round((minsSinceCm / totalTat) * 100)));
  if (pct >= 100) return { name: "Push Back Completado", color: "#4ADE80", pct: 100 };
  if (pct < 28) return { name: "Desembarque & Bodegas", color: "#38BDF8", pct };
  if (pct < 45) return { name: "Limpieza & Servicios", color: "#F59E0B", pct };
  if (pct < 82) return { name: "Embarque de Pasajeros", color: "#818CF8", pct };
  return { name: "Cierre & Entrega de Vuelo", color: "#F43F5E", pct };
}



/* ─── TEXT TIME INPUT ────────────────────────────────────────────── */
function TI({ value, onChange, color = "#fff", size = 24 }) {
  const [raw, setRaw] = useState(value || "");
  const [focused, setFocused] = useState(false);
  const handleChange = e => {
    let v = e.target.value.replace(/[^0-9:]/g, "");
    if (v.length === 2 && !v.includes(":") && raw.replace(/:/g, "").length < 2) v += ":";
    if (v.length > 5) return;
    setRaw(v);
    if (isValid(v)) onChange(`${p2(+v.split(":")[0])}:${p2(+v.split(":")[1])}`);
  };
  const handleFocus = e => { setRaw(value || ""); setFocused(true); setTimeout(() => e.target.select(), 10); };
  const handleBlur = () => {
    setFocused(false);
    const c = (raw || "").replace(/[^0-9]/g, "");
    if (c.length === 4) { const h = +c.slice(0, 2), m = +c.slice(2, 4); if (h < 24 && m < 60) { const f = `${p2(h)}:${p2(m)}`; onChange(f); setRaw(f); return; } }
    setRaw(value || "");
  };
  return (
    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="--:--"
      value={focused ? raw : (value || "")} onChange={handleChange}
      onFocus={handleFocus} onBlur={handleBlur}
      onKeyDown={e => e.key === "Enter" && e.target.blur()} maxLength={5}
      style={{
        background: "transparent", border: "none", outline: "none",
        fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: size, fontWeight: 800,
        color, width: "100%", textAlign: "center", letterSpacing: "1px",
        fontVariantNumeric: "tabular-nums", caretColor: color, padding: 0
      }} />
  );
}

/* ─── AIRLINES ───────────────────────────────────────────────────── */
const AL = {
  SKY: {
    name: "SKY Airline", code: "SKY", tat: 35,
    theme: { nav: "#0F2A5C", gradA: "#1B3A6B", gradB: "#2563EB", accent: "#4ADE80" },
    ms: [
      { label: "Avión en pea. Beacon Off",                         planOff: 0              },
      { label: "Apertura de puerta.",                              planOff: 2              },
      { label: "Inicio de desembarque.",                           planOff: 2              },
      { label: "Fin de desembarque",                               planOff: 10             },
      { label: "Inicio de limpieza.",                              planOff: 10             },
      { label: "Inicio de embarque en sala. (línea amarilla)",     planOff: 11             },
      { label: "Fin de limpieza",                                  planOff: 14             },
      { label: "Ingreso del primer pasajero al avión.",            planOff: 14             },
      { label: "Activación de búsquedas de equipajes.",            planOff: 20             },
      { label: "Confirmación de equipajes a bajarse.",             planOff: 28             },
      { label: "Entrega de vuelo.",                                planOff: 28, isEnt: true },
      { label: "Fin de embarque.",                                 planOff: 29             },
      { label: "Fin de acomodación abordo.",                       planOff: 33             },
      { label: "Cierre de puertas.",                               planOff: 33, isCp: true },
      { label: "Push back.",                                       planOff: 35, isPb: true },
    ],
    checklist: [
      "Documentos entregados al piloto (OFP, loadsheet)",
      "Puertas cerradas y armadas",
      "Escalera / finger retirado",
      "GPU / ASU desconectado",
      "Conos de rueda retirados",
      "Área libre alrededor del avión",
      "Comunicación con torre confirmada",
      "Headset conectado para pushback",
    ],
  },
  LATAM: {
    name: "LATAM Airlines", code: "LATAM", tat: 35,
    theme: { nav: "#1A1A2E", gradA: "#1A1A2E", gradB: "#0F3460", accent: "#E2B14A" },
    ms: [
      { label: "Corte Motor", planOff: 0 },
      { label: "Apertura Puertas", planOff: 2 },
      { label: "Fin Desembarque", planOff: 10 },
      { label: "Inicio Limpieza", planOff: 10 },
      { label: "Fin Limpieza", planOff: 14 },
      { label: "Pre-Embarque", planOff: 8 },
      { label: "Embarque Sala", planOff: 12 },
      { label: "Búsqueda Equipaje", planOff: 21 },
      { label: "Entrega de Vuelo", planOff: 23, isEnt: true },
      { label: "Último Pasajero", planOff: 25 },
      { label: "Acomodación a bordo", planOff: 28 },
      { label: "Cierre de Puertas", planOff: 28, isCp: true },
      { label: "Encendido Motor", planOff: 28 },
      { label: "Push Back", planOff: 35, isPb: true },
    ],
    checklist: [
      "Loadsheet firmada y entregada",
      "Puertas cerradas y cross-check confirmado",
      "Finger / escalera retirada",
      "Equipo de tierra fuera del área",
      "GPU desconectada",
      "Conos retirados — zona libre",
      "Tractor de pushback posicionado",
      "Headset y comunicación activa con cabina",
    ],
  },
};

/* ─── ICONS ──────────────────────────────────────────────────────── */
const Ic = {
  plane: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 1 16.5 2.5L13 6 4.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 5.5 5.3c.4.4.9.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
  lock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  eye: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  share: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  reset: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
  cam: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  logout: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  ok: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  warn: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  clock: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  bell: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  bellOff: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M18.63 13A17.888 17.888 0 0 1 18 8" /><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.33-5" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  hist: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
  cfg: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  wa: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>,
  list: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  pdf: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
  moon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  sun: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  timer: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="14" r="8" /><line x1="12" y1="10" x2="12" y2="14" /><path d="M12 2v4" /><path d="M10 2h4" /></svg>,
  chart: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="15" y2="6" /><line x1="6" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>,
  checkCircle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  heart: <svg width="11" height="11" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
};

/* ════════════════ SERVICE WORKER + NOTIFICATIONS ════════════════ */

// Registra el SW y solicita permiso de notificaciones
async function setupNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  try {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return true;
  } catch (e) {
    console.warn("SW no disponible:", e);
    return false;
  }
}

// Envía alertas programadas al Service Worker
async function scheduleAlerts(alerts) {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "SCHEDULE_ALERTS", alerts });
  } catch (e) { }
}

// Limpia alertas del SW
async function clearAlerts() {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "CLEAR_ALERTS" });
  } catch (e) { }
}

// Fallback: notificación inmediata desde la app (cuando está en primer plano)
function notifyNow(title, body) {
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "/icon-192.png",
    vibrate: [300, 100, 300],
    tag: "tat-" + Date.now(),
  });
}

/* ════════════════ LOGIN ════════════════ */
function Login({ onLogin }) {
  const [busy, setBusy] = useState(false);

  const go = (code) => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      onLogin(code);
    }, 120);
  };

  return (
    <div className="L">
      <div className="L-box">
        <div className="L-hdr">
          <div className="L-ico">{Ic.plane}</div>
          <h1 className="L-title">TAT Calculator</h1>
          <p className="L-sub">Control operacional de tiempos TAT</p>
        </div>

        <div className="L-options">
          <button className="L-opt-btn" onClick={() => go("SKY")} disabled={busy}>
            <span className="L-opt-dot" style={{ background: "#4ADE80" }} />
            <span className="L-opt-name">SKY Airline</span>
            <span className="L-opt-arrow">→</span>
          </button>

          <button className="L-opt-btn" onClick={() => go("LATAM")} disabled={busy}>
            <span className="L-opt-dot" style={{ background: "#E2B14A" }} />
            <span className="L-opt-name">LATAM Airlines</span>
            <span className="L-opt-arrow">→</span>
          </button>
        </div>

        <footer className="L-fo">
          hecho con {Ic.heart} por&nbsp;
          <a href="https://wsaico.com" target="_blank" rel="noopener noreferrer">wsaico</a>
        </footer>
      </div>
    </div>
  );
}


/* ════════════════ CALCULATOR ════════════════ */
function Calc({ airlineKey, onLogout }) {
  const al = AL[airlineKey];
  if (!al) return null;
  const th = al.theme;

  // Prefs
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("tat_theme");
      return saved ? saved === "dark" : isNight();
    } catch (_) {
      return isNight();
    }
  });

  useEffect(() => {
    try { localStorage.setItem("tat_theme", dark ? "dark" : "light"); } catch (_) {}
    document.body.style.background = dark ? "#03060F" : "#F4F6F9";
    document.documentElement.style.background = dark ? "#03060F" : "#F4F6F9";
  }, [dark]);

  const [alertAt, setAlertAt] = useState(5);
  const [penRate, setPenRate] = useState(0);
  const [notifOk, setNotifOk] = useState(false); // permiso concedido
  const [showCfg, setShowCfg] = useState(false);

  // Vista
  const [view, setView] = useState("calc");
  const [viewMode, setViewMode] = useState("timer"); // "timer" (Con Temporizador) | "gantt" (Solo Carta Gantt)

  // Vuelo
  const now0 = nowHHMM();
  const defETD = addMins(now0, 40);
  const defCM = addMins(defETD, -al.tat);
  const [etdItin, setEtdItin] = useState(defETD);
  const [cmReal, setCmReal] = useState(defCM);
  const [obs, setObs] = useState("");

  // Checklist
  const [showCL, setShowCL] = useState(false);
  const [clDone, setClDone] = useState({});
  const clChecked = Object.values(clDone).filter(Boolean).length;
  const clComplete = clChecked === al.checklist.length;

  // Historial
  const LS_KEY = `tat_hist_${airlineKey}`;
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } });
  const saveHistory = h => { setHistory(h); try { localStorage.setItem(LS_KEY, JSON.stringify(h)); } catch { } };

  // Countdown ticker
  const [ticker, setTicker] = useState(0);
  useEffect(() => { const id = setInterval(() => setTicker(t => t + 1), 1000); return () => clearInterval(id); }, []);

  // Capture
  const [ov, setOv] = useState(null);
  const [showWA, setShowWA] = useState(false); // panel WA rápido
  const capRef = useRef(null);

  // Notificaciones ya disparadas (para no repetir)
  const firedRef = useRef({});
  const { wakeLockActive, toggleWakeLock } = useWakeLock();

  const handleToggleCl = i => {
    setClDone(p => {
      const nextVal = !p[i];
      const newDone = { ...p, [i]: nextVal };
      const checkedCount = Object.values(newDone).filter(Boolean).length;
      if (checkedCount === al.checklist.length) triggerFeedback("chime");
      else triggerFeedback("tap");
      return newDone;
    });
  };

  /* ── Calculations ────────────────────────────────────────────── */
  const cmPlan = addMins(etdItin, -al.tat);
  const cmDelta = subT(cmPlan, cmReal);
  const nowMinsVal = toMins(nowHHMM());
  const minsSinceCm = nowMinsVal - toMins(cmReal);
  const tatPhase = getTatPhase(minsSinceCm, al.tat);
  const rows = al.ms.map((m, i) => {
    const real = addMins(cmReal, m.planOff);
    const plan = addMins(cmPlan, m.planOff);
    const rMins = toMins(real);
    const prevRMins = i === 0 ? toMins(cmReal) : toMins(addMins(cmReal, al.ms[i - 1].planOff));
    const isPast = nowMinsVal > rMins;
    const isCurrent = (i === 0 && nowMinsVal <= rMins) || (nowMinsVal >= prevRMins && nowMinsVal <= rMins);
    return {
      ...m,
      plan,
      real,
      diff: cmDelta,
      isPast,
      isCurrent,
    };
  });
  const entRow = rows.find(r => r.isEnt);
  const cpRow = rows.find(r => r.isCp);
  const pbRow = rows.find(r => r.isPb);
  const isLate = cmDelta > 0;
  const isEarly = cmDelta < 0;
  const penalty = penRate > 0 && isLate ? (cmDelta * penRate).toFixed(0) : null;

  const SC = isLate ? "#EF4444" : "#4ADE80";
  const SBg = isLate ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)";
  const SBr = isLate ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)";

  const smartMsg = isLate
    ? `Llegó ${fmtDur(cmDelta)} tarde — entregar antes de ${entRow.plan}, PB ${pbRow.real}`
    : isEarly
      ? `Llegó ${fmtDur(-cmDelta)} adelantado — ETD fijo ${etdItin}, entrega: ${entRow.real} (Máx: ${entRow.plan})`
      : `En tiempo — Entrega: ${entRow.plan} · PB: ${pbRow.real}`;

  /* ── Countdown ────────────────────────────────────────────────── */
  const entSecs = toMins(entRow.real) * 60;
  const nowSec = nowSecs();
  const secsLeft = entSecs - nowSec;
  const cdMins2 = Math.floor(Math.abs(secsLeft) / 60);
  const cdSecs2 = Math.abs(secsLeft) % 60;
  const cdStr = `${p2(cdMins2)}:${p2(cdSecs2)}`;
  const entPassed = secsLeft < 0;
  const cdUrgent = secsLeft > 0 && secsLeft <= alertAt * 60;

  /* ── Setup notificaciones al montar ──────────────────────────── */
  useEffect(() => {
    setupNotifications().then(ok => setNotifOk(ok));
  }, []);

  /* ── WhatsApp text builder ────────────────────────────────────── */
  const buildWA = useCallback(() => {
    const status = isLate ? `ESTADO: DEMORADO +${fmtDur(cmDelta)}` : isEarly ? `ESTADO: ADELANTADO -${fmtDur(-cmDelta)}` : `ESTADO: A TIEMPO`;
    return [
      `*TAT DISPATCH — ${al.name.toUpperCase()}*`,
      `FECHA: ${new Date().toLocaleDateString("es-PE")} ${nowHHMM()}`, ``,
      `ETD ITINERARIO: *${etdItin}*`,
      `CM REAL: *${cmReal}* (PLAN: ${cmPlan})`,
      `ENTREGA DE VUELO: *${entRow.real}* (PLAN: ${entRow.plan})`,
      `PUSH BACK: *${pbRow.real}* (PLAN: ${pbRow.plan})`,
      penalty ? `PENALIDAD: USD ${penalty}` : "", ``,
      status,
      obs ? `OBSERVACIONES: ${obs}` : "", ``,
      `CHECKLIST: ${clComplete ? "COMPLETO" : `${clChecked}/${al.checklist.length}`}`,
      `_TAT Calculator · wsaico.com_`,
    ].filter(l => l !== "").join("\n");
  }, [al, etdItin, cmReal, cmPlan, entRow, pbRow, isLate, isEarly, cmDelta, penalty, obs, clComplete, clChecked]);

  const sendWA = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildWA())}`, "_blank");

  /* ── Programar alertas via Service Worker ────────────────────── */
  useEffect(() => {
    if (!notifOk) return;
    const waText = buildWA();
    const flightLabel = al.name;

    const alerts = [
      // Alerta configurable antes del Push back
      {
        id: "pre-pb",
        title: `${alertAt} min para Push Back`,
        body: `${flightLabel} — PB a las ${pbRow.real}. Checklist pendiente.`,
        fireAt: hhmm2ts(pbRow.real) - alertAt * 60 * 1000,
        tag: "tat-pre-pb",
        waText,
      },
      // Entrega de vuelo (exacta)
      {
        id: "ent",
        title: `Entrega de vuelo ahora`,
        body: `${flightLabel} — Entrega: ${entRow.real}. Cierre puertas: ${cpRow?.real || "—"}`,
        fireAt: hhmm2ts(entRow.real),
        tag: "tat-ent",
        waText,
      },
      // Cierre de puertas
      {
        id: "cp",
        title: `Cierre de puertas`,
        body: `${flightLabel} — Cerrar puertas ahora. Push Back: ${pbRow.real}`,
        fireAt: hhmm2ts(cpRow?.real || pbRow.real),
        tag: "tat-cp",
        waText,
      },
      // Push back exacto
      {
        id: "pb",
        title: `Push Back — ${pbRow.real}`,
        body: `${flightLabel} — ETD: ${etdItin}. ${isLate ? `Demora de +${fmt(cmDelta)}` : "A tiempo"}`,
        fireAt: hhmm2ts(pbRow.real),
        tag: "tat-pb",
        waText,
      },
    ].filter(a => a.fireAt > Date.now()); // solo alertas futuras

    scheduleAlerts(alerts);
    return () => { clearAlerts(); };
  }, [notifOk, cmReal, etdItin, alertAt, buildWA]);

  /* ── Fallback en primer plano (cuando SW no puede notificar) ── */
  useEffect(() => {
    if (!notifOk) return;
    const now = Date.now();
    const lbl = al.name;
    const checks = [
      { key: "ent", ts: hhmm2ts(entRow.real), title: `Entrega de vuelo ahora`, body: `${lbl} — ${entRow.real}` },
      { key: "cp", ts: hhmm2ts(cpRow?.real || pbRow.real), title: `Cierre de puertas`, body: `${lbl} — PB a las ${pbRow.real}` },
      { key: "pb", ts: hhmm2ts(pbRow.real), title: `Push Back`, body: `${lbl} — ETD ${etdItin}` },
      { key: "pre", ts: hhmm2ts(pbRow.real) - alertAt * 60 * 1000, title: `${alertAt} min para Push Back`, body: `${lbl} — Checklist pendiente` },
    ];
    checks.forEach(c => {
      if (!firedRef.current[c.key] && Math.abs(now - c.ts) < 30000) {
        firedRef.current[c.key] = true;
        notifyNow(c.title, c.body);
        if (navigator.vibrate) navigator.vibrate([400, 100, 400, 100, 400]);
      }
    });
  }, [ticker]);

  /* ── Auto show checklist near pushback ─────────────────────── */
  useEffect(() => {
    if (cdUrgent && !showCL && !clComplete) setShowCL(true);
  }, [cdUrgent]);

  /* ── Guardar en historial ─────────────────────────────────────── */
  const doSave = () => {
    const e2 = {
      id: Date.now(), date: new Date().toLocaleDateString("es-PE"), time: nowHHMM(),
      airline: airlineKey,
      etd: etdItin, cmPlan, cmReal,
      pbPlan: pbRow.plan, pbReal: pbRow.real, delta: cmDelta,
      obs: obs || "",
      penalty: penalty || "", clComplete,
    };
    saveHistory([e2, ...history].slice(0, 30));
  };

  /* ── PDF del turno ────────────────────────────────────────────── */
  const exportPDF = () => {
    const lates = history.filter(h => h.delta > 0).length;
    const ontime = history.filter(h => h.delta <= 0).length;
    const avgD = history.length ? Math.round(history.reduce((a, h) => a + h.delta, 0) / history.length) : 0;
    const tableRows = history.map(h => { const lt = h.delta > 0, el = h.delta < 0; return `<tr><td>${h.date} ${h.time}</td><td><b>${h.airline}</b></td><td>${h.etd}</td><td>${h.cmReal}</td><td>${h.pbReal}</td><td style="color:${lt ? "#EF4444" : el ? "#16a34a" : "#94A3B8"};font-weight:700">${h.delta === 0 ? "A TIEMPO" : lt ? `DEMORA +${fmtDur(h.delta)}` : `ADELANTO -${fmtDur(-h.delta)}`}</td><td>${h.penalty ? `USD ${h.penalty}` : "-"}</td></tr>`; }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte TAT — ${al.name}</title><style>body{font-family:'Segoe UI',sans-serif;padding:32px;color:#1E293B;font-size:13px;}h1{font-size:22px;margin-bottom:4px;}h2{font-size:14px;color:#64748B;font-weight:400;margin-bottom:24px;}.kpis{display:flex;gap:16px;margin-bottom:24px;}.kpi{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 18px;text-align:center;}.kpi-v{font-size:24px;font-weight:800;}.kpi-l{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;}table{width:100%;border-collapse:collapse;}th{background:#F1F5F9;padding:8px 10px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;}td{padding:8px 10px;border-bottom:1px solid #F1F5F9;font-size:12px;}.ft{margin-top:32px;font-size:10px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;padding-top:12px;}</style></head><body><h1>Reporte de Turno — ${al.name}</h1><h2>${new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h2><div class="kpis"><div class="kpi"><div class="kpi-v">${history.length}</div><div class="kpi-l">Vuelos</div></div><div class="kpi"><div class="kpi-v" style="color:#16a34a">${ontime}</div><div class="kpi-l">A tiempo</div></div><div class="kpi"><div class="kpi-v" style="color:#EF4444">${lates}</div><div class="kpi-l">Demorados</div></div><div class="kpi"><div class="kpi-v" style="color:${avgD > 0 ? "#EF4444" : avgD < 0 ? "#16a34a" : "#94A3B8"}">${avgD > 0 ? "+" : ""}${avgD}'</div><div class="kpi-l">Promedio</div></div></div><table><thead><tr><th>Fecha/Hora</th><th>Aerolínea</th><th>ETD</th><th>CM Real</th><th>PB Real</th><th>Estado</th><th>Penalidad</th></tr></thead><tbody>${tableRows}</tbody></table><div class="ft">Generado por TAT Calculator · wsaico.com</div></body></html>`;
    const w = window.open("", "_blank"); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
  };

  /* ── html2canvas ──────────────────────────────────────────────── */
  const loadH2C = () => new Promise((res, rej) => { if (window.html2canvas) return res(); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const capture = useCallback(async () => { try { await loadH2C(); const c = await window.html2canvas(capRef.current, { backgroundColor: "#080D1A", scale: 2.5, useCORS: true, logging: false }); setOv(c.toDataURL("image/png")); } catch (e) { console.error(e); } }, []);
  const doShareImg = useCallback(async () => { if (!ov) return; try { const b = await (await fetch(ov)).blob(); const f = new File([b], "TAT.png", { type: "image/png" }); if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: `TAT ${airlineKey}` }); return; } } catch (_) { } Object.assign(document.createElement("a"), { href: ov, download: `TAT_${airlineKey}.png` }).click(); }, [ov, airlineKey]);

  // Theme
  const bg = dark ? "#0F172A" : "#F4F6F9";
  const card = dark ? "#1E293B" : "#FFFFFF";
  const txt = dark ? "#E2E8F0" : "#334155";
  const mut = dark ? "#64748B" : "#94A3B8";
  const bdr = dark ? "#334155" : "#F1F5F9";

  /* ══════════════════ HISTORY VIEW ══════════════════════════════ */
  if (view === "hist") return (
    <div className="A" style={{ background: bg }}>
      <nav className="N" style={{ background: th.nav }}>
        <div className="N-l">
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 20, display: "flex", alignItems: "center", padding: "4px 8px 4px 0" }} onClick={() => setView("calc")}>←</button>
          <span className="N-nm">Historial del turno</span>
        </div>
        <div className="N-r">
          {history.length > 0 && <button className="N-ico-btn" onClick={exportPDF}>{Ic.pdf}</button>}
          <span className="N-cd" style={{ color: th.accent }}>{al.code}</span>
        </div>
      </nav>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {history.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: mut }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: mut, marginBottom: 10 }}>{Ic.hist}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: txt }}>Sin vuelos registrados</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Guarda vuelos desde la calculadora</div>
          </div>
        )}
        {history.length > 0 && (() => {
          const ontime = history.filter(h => h.delta <= 0).length;
          const otp = Math.round((ontime / history.length) * 100);
          const totalDel = history.reduce((acc, h) => acc + (h.delta > 0 ? h.delta : 0), 0);
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12, background: card, borderRadius: 12, padding: "10px 8px", border: `1px solid ${bdr}` }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: mut, marginBottom: 2 }}>VUELOS</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: txt }}>{history.length}</div>
              </div>
              <div style={{ textAlign: "center", borderLeft: `1px solid ${bdr}`, borderRight: `1px solid ${bdr}` }}>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: mut, marginBottom: 2 }}>OTP (A TIEMPO)</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: otp >= 85 ? "#4ADE80" : otp >= 70 ? "#F59E0B" : "#EF4444" }}>{otp}%</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: mut, marginBottom: 2 }}>DEMORA NETA</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: totalDel > 0 ? "#EF4444" : "#4ADE80" }}>{totalDel > 0 ? `+${totalDel}'` : "0'"}</div>
              </div>
            </div>
          );
        })()}
        {history.map(h => {
          const lt = h.delta > 0, el = h.delta < 0;
          const sc = lt ? "#EF4444" : el ? "#4ADE80" : mut;
          const sb = lt ? "rgba(239,68,68,0.1)" : el ? "rgba(74,222,128,0.1)" : "rgba(148,163,184,0.1)";
          const ds = h.delta === 0 ? "En tiempo" : lt ? `+${fmtDur(h.delta)} demorado` : `${fmtDur(-h.delta)} adelantado`;
          return (
            <div key={h.id} style={{ background: card, borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: `1px solid ${bdr}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: txt }}>{h.airline}</span>
                  {h.clComplete && <span style={{ fontSize: 9, fontWeight: 700, color: "#4ADE80", background: "rgba(74,222,128,0.1)", borderRadius: 6, padding: "2px 7px" }}>CL OK</span>}
                </div>
                <button onClick={() => saveHistory(history.filter(x => x.id !== h.id))} style={{ background: "none", border: "none", cursor: "pointer", color: mut, display: "flex" }}>{Ic.trash}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                {[["ETD", h.etd], ["CM Real", h.cmReal], ["Push Back", h.pbReal]].map(([l, v]) => (
                  <div key={l} style={{ textAlign: "center" }}><div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: mut, marginBottom: 2 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 800, color: txt, fontVariantNumeric: "tabular-nums" }}>{v}</div></div>
                ))}
              </div>
              {h.penalty && <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", marginBottom: 3 }}>PENALIDAD: USD {h.penalty}</div>}
              {h.obs && <div style={{ fontSize: 10, color: mut, fontStyle: "italic", borderTop: `1px solid ${bdr}`, paddingTop: 5, marginTop: 4 }}>{h.obs}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
                <span style={{ fontSize: 10, color: mut }}>{h.date} {h.time}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sb, padding: "3px 8px", borderRadius: 10 }}>{ds}</span>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="F" style={{ color: mut }}>hecho con {Ic.heart} por&nbsp;<a href="https://wsaico.com" target="_blank" rel="noopener noreferrer" style={{ color: mut }}>wsaico</a></footer>
    </div>
  );

  /* ══════════════════ MAIN CALC VIEW ════════════════════════════ */
  return (
    <div className="A" style={{ background: bg }}>

      {/* ── CONFIG MODAL ──────────────────────────────────────── */}
      {showCfg && (
        <div className="MOD" onClick={() => setShowCfg(false)}>
          <div className="MOD-box" style={{ background: card, border: `1px solid ${bdr}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: txt }}>Configuración</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: mut, fontSize: 18 }} onClick={() => setShowCfg(false)}>✕</button>
            </div>

            {/* Notificaciones */}
            <div style={{ padding: "10px 12px", borderRadius: 10, background: notifOk ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${notifOk ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.2)"}`, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", color: notifOk ? "#4ADE80" : "#EF4444" }}>{notifOk ? Ic.bell : Ic.bellOff}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: notifOk ? "#4ADE80" : "#EF4444" }}>{notifOk ? "Notificaciones activas" : "Notificaciones desactivadas"}</div>
                <div style={{ fontSize: 10, color: mut, marginTop: 2 }}>{notifOk ? "Recibirás alertas aunque cierres la app" : "Toca para activar permisos"}</div>
              </div>
              {!notifOk && <button onClick={() => setupNotifications().then(ok => setNotifOk(ok))} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Activar</button>}
            </div>

            {/* Mantener pantalla encendida (Wake Lock) */}
            <div style={{ padding: "10px 12px", borderRadius: 10, background: wakeLockActive ? "rgba(251,191,36,0.08)" : (dark ? "rgba(255,255,255,0.03)" : "#F8FAFC"), border: `1px solid ${wakeLockActive ? "rgba(251,191,36,0.3)" : bdr}`, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: wakeLockActive ? "#FBBF24" : mut, display: "flex" }}>{wakeLockActive ? Ic.sun : Ic.moon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: txt }}>Mantener pantalla encendida</div>
                  <div style={{ fontSize: 10, color: mut, marginTop: 2 }}>Evita que el teléfono se bloquee durante el turno</div>
                </div>
              </div>
              <button onClick={toggleWakeLock} style={{ background: wakeLockActive ? "#FBBF24" : "#475569", border: "none", borderRadius: 20, width: 44, height: 24, cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: wakeLockActive ? 22 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left .2s", display: "block" }} />
              </button>
            </div>

            <label style={{ fontSize: 10, fontWeight: 700, color: mut, letterSpacing: "1.5px", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Alerta antes del Push back</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 16 }}>
              {[3, 5, 10, 15].map(m => (
                <button key={m} onClick={() => setAlertAt(m)} style={{ padding: "8px 0", borderRadius: 9, border: `1.5px solid ${alertAt === m ? th.accent : bdr}`, background: alertAt === m ? `${th.accent}18` : card, color: alertAt === m ? th.accent : mut, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {m} min
                </button>
              ))}
            </div>

            <label style={{ fontSize: 10, fontWeight: 700, color: mut, letterSpacing: "1.5px", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Costo por minuto de demora (USD)</label>
            <input type="number" min="0" placeholder="0 = desactivado" value={penRate || ""} onChange={e => setPenRate(+e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${bdr}`, borderRadius: 9, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 600, color: txt, background: dark ? "#0F172A" : "#F8FAFC", outline: "none", marginBottom: 8 }} />
            {penRate > 0 && <div style={{ padding: "8px 10px", background: dark ? "rgba(255,255,255,0.03)" : "#F8FAFC", borderRadius: 8, fontSize: 11, color: mut, marginBottom: 16 }}>5 min demora → USD {(5 * penRate).toFixed(0)}</div>}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: txt }}>Modo oscuro</span>
              <button onClick={() => setDark(d => !d)} style={{ background: dark ? th.accent : "#CBD5E1", border: "none", borderRadius: 20, width: 44, height: 24, cursor: "pointer", position: "relative", transition: "background .2s" }}>
                <span style={{ position: "absolute", top: 3, left: dark ? 22 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left .2s", display: "block" }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECKLIST MODAL ───────────────────────────────────── */}
      {showCL && (
        <div className="MOD" onClick={() => setShowCL(false)}>
          <div className="MOD-box" style={{ background: card, border: `1px solid ${bdr}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: txt }}>Checklist de cierre</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: mut, fontSize: 18 }} onClick={() => setShowCL(false)}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: mut, marginBottom: 10 }}>{clChecked}/{al.checklist.length} completados · PB a las {pbRow.real}</div>
            <div style={{ width: "100%", height: 3, background: bdr, borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(clChecked / al.checklist.length) * 100}%`, background: clComplete ? "#4ADE80" : th.accent, borderRadius: 3, transition: "width .3s" }} />
            </div>
            {al.checklist.map((item, i) => (
              <button key={i} onClick={() => handleToggleCl(i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", background: "none", border: "none", borderBottom: `1px solid ${bdr}`, cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${clDone[i] ? "#4ADE80" : bdr}`, background: clDone[i] ? "#4ADE80" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
                  {clDone[i] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </span>
                <span style={{ fontSize: 12, fontWeight: clDone[i] ? 400 : 600, color: clDone[i] ? mut : txt, textDecoration: clDone[i] ? "line-through" : "none" }}>{item}</span>
              </button>
            ))}
            {clComplete && <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, color: "#4ADE80", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{Ic.checkCircle} Listo para Push back</div>}
          </div>
        </div>
      )}

      {/* ── WHATSAPP QUICK PANEL ──────────────────────────────── */}
      {showWA && (
        <div className="MOD" onClick={() => setShowWA(false)}>
          <div className="MOD-box" style={{ background: card, border: `1px solid ${bdr}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#25D366", display: "flex" }}>{Ic.wa}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: txt }}>Compartir por WhatsApp</span>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: mut, fontSize: 18 }} onClick={() => setShowWA(false)}>✕</button>
            </div>

            {/* Preview del reporte */}
            <div style={{ background: dark ? "#0F172A" : "#F8FAFC", border: `1px solid ${bdr}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, maxHeight: 200, overflowY: "auto" }}>
              <pre style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, color: mut, whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{buildWA()}</pre>
            </div>

            {/* Botones de acción */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <button onClick={sendWA} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 0", borderRadius: 12, border: "none", background: "#25D366", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {Ic.wa} Abrir WhatsApp
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(buildWA()); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 0", borderRadius: 12, border: `1px solid ${bdr}`, background: card, color: txt, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {Ic.copy} Copiar texto
              </button>
            </div>

            {/* Captura imagen + share */}
            <button onClick={async () => { setShowWA(false); await capture(); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", borderRadius: 12, border: `1px solid ${bdr}`, background: card, color: mut, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {Ic.cam} Capturar imagen para compartir
            </button>
          </div>
        </div>
      )}

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className="N" style={{ background: th.nav }}>
        <div className="N-l">
          <span style={{ color: th.accent, display: "flex" }}>{Ic.plane}</span>
          <span className="N-nm">TAT Calculator</span>
        </div>
        <div className="N-r">
          {/* Alternar Modo Claro / Oscuro */}
          <button
            className="N-ico-btn"
            onClick={() => {
              setDark(d => !d);
              triggerFeedback("tap");
            }}
            title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{ color: dark ? "#FBBF24" : "#E2E8F0" }}
          >
            {dark ? Ic.sun : Ic.moon}
          </button>
          <button className="N-ico-btn" onClick={() => setView("hist")} style={{ position: "relative" }} title="Historial">
            {Ic.hist}
            {history.length > 0 && <span className="N-badge">{history.length}</span>}
          </button>
          <button className="N-ico-btn" onClick={() => setShowCfg(true)} title="Configuración">{Ic.cfg}</button>
          <span className="N-cd" style={{ color: th.accent }}>{al.code}</span>
          <button className="N-out" onClick={onLogout} title="Cerrar sesión">{Ic.logout}</button>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <div className="H" style={{ background: `linear-gradient(160deg,${th.gradA},${th.gradB})` }}>

        {/* Selector de Modo (50/50 Segmented Control) */}
        <div className="H-mode-switch">
          <button
            className={`H-mode-btn ${viewMode === "timer" ? "active" : ""}`}
            onClick={() => setViewMode("timer")}
            style={{
              background: viewMode === "timer" ? th.accent : "transparent",
              color: viewMode === "timer" ? "#061A0C" : "rgba(255,255,255,0.7)",
            }}
          >
            {Ic.timer} Modo En Vivo
          </button>
          <button
            className={`H-mode-btn ${viewMode === "gantt" ? "active" : ""}`}
            onClick={() => setViewMode("gantt")}
            style={{
              background: viewMode === "gantt" ? th.accent : "transparent",
              color: viewMode === "gantt" ? "#061A0C" : "rgba(255,255,255,0.7)",
            }}
          >
            {Ic.chart} Carta Gantt
          </button>
        </div>

        {/* Status message */}
        <div className="H-msg" style={{ background: SBg, border: `1px solid ${SBr}`, color: SC }}>
          <span style={{ display: "flex", flexShrink: 0 }}>{isLate ? Ic.warn : Ic.ok}</span>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>{smartMsg}</span>
          {penalty && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#F59E0B", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.5px" }}>PENALIDAD: USD {penalty}</span>}
        </div>

        {/* Time inputs con Quick Steppers */}
        <div className="H-inp-row">
          <div className="H-inp-card">
            <span className="H-inp-lbl">CM REAL</span>
            <TI value={cmReal} onChange={setCmReal} color="#fff" size={24} />
            <span className="H-inp-sub">hora llegada real</span>
            <div className="H-quick-row">
              <button onClick={() => { setCmReal(addMins(cmReal, -5)); firedRef.current = {}; triggerFeedback("tap"); }} className="H-quick-btn" title="-5 min">-5'</button>
              <button onClick={() => { setCmReal(nowHHMM()); firedRef.current = {}; triggerFeedback("chime"); }} className="H-quick-btn H-quick-now" title="Estampar hora actual">Ahora</button>
              <button onClick={() => { setCmReal(addMins(cmReal, 5)); firedRef.current = {}; triggerFeedback("tap"); }} className="H-quick-btn" title="+5 min">+5'</button>
            </div>
          </div>
          <div className="H-inp-card" style={{ borderColor: `${th.accent}55` }}>
            <span className="H-inp-lbl" style={{ color: th.accent }}>ETD ITINERARIO</span>
            <TI value={etdItin} onChange={setEtdItin} color={th.accent} size={24} />
            <span className="H-inp-sub">despegue programado</span>
            <div className="H-quick-row">
              <button onClick={() => { setEtdItin(addMins(etdItin, -5)); firedRef.current = {}; triggerFeedback("tap"); }} className="H-quick-btn" title="-5 min">-5'</button>
              <button onClick={() => { setEtdItin(addMins(nowHHMM(), al.tat)); firedRef.current = {}; triggerFeedback("tap"); }} className="H-quick-btn" title="ETD = Ahora + TAT">Std</button>
              <button onClick={() => { setEtdItin(addMins(etdItin, 5)); firedRef.current = {}; triggerFeedback("tap"); }} className="H-quick-btn" title="+5 min">+5'</button>
            </div>
          </div>
        </div>

        {/* COUNTDOWN (Visible solo en Modo Timer) */}
        {viewMode === "timer" && (
          <div className={`H-cd${cdUrgent ? " H-cd-u" : ""}`} style={{
            background: cdUrgent ? "rgba(239,68,68,0.2)" : "rgba(0,0,0,0.2)",
            borderColor: cdUrgent ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.1)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: cdUrgent ? "#EF4444" : "rgba(255,255,255,0.35)", marginBottom: 1 }}>{entPassed ? "Entrega hace" : "Entrega en"}</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "2px", color: cdUrgent ? "#EF4444" : entPassed ? "rgba(255,255,255,0.25)" : "#fff", lineHeight: 1 }}>{cdStr}</div>
              <div style={{ fontSize: 10, color: SC, fontWeight: 700, marginTop: 2 }}>Target: {entRow.real} · Máx: {entRow.plan}</div>
            </div>
            {/* Checklist status */}
            <button onClick={() => setShowCL(true)} style={{ background: clComplete ? "rgba(74,222,128,0.2)" : cdUrgent ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)", border: `1px solid ${clComplete ? "rgba(74,222,128,0.35)" : cdUrgent ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "8px 10px", cursor: "pointer", color: clComplete ? "#4ADE80" : cdUrgent ? "#EF4444" : "rgba(255,255,255,0.45)", fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{clComplete ? Ic.checkCircle : Ic.list}</span>
              <span style={{ fontSize: 9, fontWeight: 700 }}>{clChecked}/{al.checklist.length}</span>
            </button>
          </div>
        )}

        {/* Cockpit Timeline & Progress Bar (Modo En Vivo) */}
        {viewMode === "timer" && (
          <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
                FASE: <b style={{ color: tatPhase.color }}>{tatPhase.name}</b>
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: th.accent, fontVariantNumeric: "tabular-nums" }}>
                {tatPhase.pct}% TAT
              </span>
            </div>
            <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", position: "relative" }}>
              <div style={{
                width: `${tatPhase.pct}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${tatPhase.color}88, ${tatPhase.color})`,
                borderRadius: 10,
                transition: "width 0.4s ease",
                boxShadow: `0 0 8px ${tatPhase.color}88`
              }} />
            </div>
          </div>
        )}

        {/* Alerts strip */}
        <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
          {[
            { label: "Ent. Vuelo", time: entRow.real, color: "rgba(255,255,255,0.5)" },
            { label: "Cierre puertas", time: cpRow?.real, color: "rgba(255,255,255,0.5)" },
            { label: "Push Back", time: pbRow.real, color: SC },
          ].map((a, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(0,0,0,0.15)", borderRadius: 8, padding: "5px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 2 }}>{a.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: a.color, fontVariantNumeric: "tabular-nums" }}>{a.time || "--:--"}</div>
            </div>
          ))}
        </div>

        {/* Summary strip cm plan */}
        <div style={{ display: "flex", gap: 5 }}>
          {[["CM plan", cmPlan], ["Ent. plan", entRow.plan], ["PB plan", pbRow.plan]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "rgba(0,0,0,0.12)", borderRadius: 7, padding: "4px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>{l}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>


      {/* TABLE HEADER */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 40px 40px", gap: 4, padding: "6px 12px 4px", background: card, borderBottom: `1px solid ${bdr}`, position: "sticky", top: 0, zIndex: 5 }}>
        {["HITO", "PLAN", "REAL", "DIF"].map((l, i) => (
          <span key={l} style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: mut, textAlign: i > 0 ? "center" : "left" }}>{l}</span>
        ))}
      </div>

      {/* MILESTONE ROWS */}
      <div className="ML">
        {rows.map((r, i) => {
          const lt = r.diff > 0, el = r.diff < 0;
          const dc = lt ? "#EF4444" : el ? "#4ADE80" : mut;
          const ds = r.diff === 0 ? "00:00" : lt ? `+${fmtDur(r.diff)}` : `−${fmtDur(-r.diff)}`;
          const bg2 = r.isCurrent
            ? (dark ? "rgba(37,99,235,0.22)" : "#EFF6FF")
            : r.isEnt ? (dark ? "rgba(74,222,128,0.08)" : "#F0FDF4")
            : r.isPb ? (dark ? "rgba(129,140,248,0.08)" : "#EEF2FF")
            : r.isCp ? (dark ? "rgba(251,191,36,0.06)" : "#FFFBEB")
            : lt ? (dark ? "rgba(239,68,68,0.05)" : "#FEF9F9")
            : el ? (dark ? "rgba(74,222,128,0.04)" : "#F7FEF7")
            : card;
          const bl = r.isCurrent
            ? "#38BDF8"
            : r.isEnt ? th.accent
            : r.isPb ? "#818CF8"
            : r.isCp ? "#F59E0B"
            : lt ? "#EF4444"
            : el ? "#4ADE80"
            : bdr;
          const lbl = r.isCurrent
            ? (dark ? "#7DD3FC" : "#0369A1")
            : r.isEnt ? (dark ? "#86EFAC" : "#166534")
            : r.isPb ? (dark ? "#A5B4FC" : "#3730A3")
            : r.isCp ? (dark ? "#FCD34D" : "#92400E")
            : txt;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 40px 40px 40px", gap: 4, alignItems: "center", background: bg2, borderRadius: 10, padding: "8px 10px", marginBottom: 4, borderLeft: `3px solid ${bl}`, border: r.isCurrent ? `1px solid ${dark ? "rgba(56,189,248,0.4)" : "rgba(37,99,235,0.3)"}` : undefined, animation: `rIn .15s ease ${i * 8}ms both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: bl, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: r.isCurrent || r.isEnt || r.isPb || r.isCp ? 700 : 600, color: lbl, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                {r.isCurrent && (
                  <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 800, letterSpacing: "0.5px", padding: "2px 6px", borderRadius: 6, background: "#38BDF8", color: "#0F172A", textTransform: "uppercase" }}>
                    Actual
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, textAlign: "center", color: mut, fontVariantNumeric: "tabular-nums" }}>{r.plan}</span>
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: lt ? "#EF4444" : el ? (dark ? "#86EFAC" : "#15803D") : txt, fontVariantNumeric: "tabular-nums" }}>{r.real}</span>
              <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center", color: dc, fontVariantNumeric: "tabular-nums" }}>{ds}</span>
            </div>
          );
        })}
      </div>

      {/* OBSERVATIONS */}
      <div style={{ padding: "6px 12px 4px" }}>
        <textarea placeholder="Observaciones del vuelo..." value={obs} onChange={e => setObs(e.target.value)} rows={2}
          style={{ width: "100%", background: card, border: `1px solid ${bdr}`, borderRadius: 10, padding: "8px 10px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: txt, resize: "none", outline: "none", lineHeight: 1.5 }} />
      </div>

      {/* FOOTER */}
      <footer className="F" style={{ color: mut }}>hecho con {Ic.heart} por&nbsp;<a href="https://wsaico.com" target="_blank" rel="noopener noreferrer" style={{ color: mut }}>wsaico</a></footer>

      {/* BOTTOM BAR */}
      <div className="B" style={{ background: card, borderColor: bdr }}>
        <button className="B-btn" style={{ color: mut }} onClick={() => { setCmReal(defCM); setEtdItin(defETD); setObs(""); setClDone({}); firedRef.current = {}; clearAlerts(); }}>
          {Ic.reset}<span>Reset</span>
        </button>
        <button className="B-btn" style={{ color: mut }} onClick={() => setShowWA(true)}>
          {Ic.wa}<span>WhatsApp</span>
        </button>
        <button className="B-fab" style={{ background: `linear-gradient(135deg,${th.gradA},${th.gradB})`, border: "1px solid rgba(255,255,255,0.15)" }} title="Guardar y capturar" onClick={() => { doSave(); capture(); }}>
          {Ic.cam}
        </button>
        <button className="B-btn" style={{ color: clComplete ? "#4ADE80" : cdUrgent ? "#EF4444" : mut, position: "relative" }} onClick={() => setShowCL(true)}>
          {Ic.list}<span>Check</span>
          {!clComplete && <span style={{ position: "absolute", top: 1, right: 8, width: 6, height: 6, borderRadius: "50%", background: cdUrgent ? "#EF4444" : "#F59E0B" }} />}
        </button>
        <button className="B-btn" style={{ color: mut }} onClick={() => setView("hist")}>
          {Ic.hist}<span>Historial</span>
        </button>
      </div>

      {/* CAPTURE OFFSCREEN */}
      <div id="cap" ref={capRef} style={{ width: 390, background: "#080D1A", color: "#F8FAFC", fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: "hidden", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
        {/* Cabecera oficial con gradiente de aerolínea */}
        <div style={{ background: `linear-gradient(135deg,${th.gradA},${th.gradB})`, padding: "16px 18px 14px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>{al.name}</div>
            <div style={{ background: SBg, border: `1px solid ${SBr}`, borderRadius: 20, padding: "4px 10px", fontSize: 9, fontWeight: 800, color: SC, whiteSpace: "nowrap" }}>
              {isLate ? `DEMORA +${fmtDur(cmDelta)}` : isEarly ? `ADELANTO −${fmtDur(-cmDelta)}` : "A TIEMPO"}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8.5, color: "rgba(255,255,255,0.45)", fontWeight: 600, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 6, marginTop: 4 }}>
            <span>{new Date().toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
            <span>TAT NOMINAL: <b style={{ color: "#fff" }}>{al.tat} MIN</b></span>
          </div>
        </div>

        {/* 4 Cards de Telemetría Rápida */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: "12px 14px 6px" }}>
          {[
            ["CM REAL", cmReal, "#fff", "Llegada"],
            ["ETD ITIN", etdItin, th.accent, "Itinerario"],
            ["ENTREGA", entRow.plan, "rgba(255,255,255,0.8)", "Target"],
            ["PUSH BACK", pbRow.real, SC, "Salida"],
          ].map(([l, v, c, sub]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Tabla de Hitos en Dark Cockpit */}
        <div style={{ padding: "6px 14px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 42px 42px 42px", gap: 4, padding: "0 6px 6px", fontSize: 7.5, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span>HITO OPERATIVO</span>
            <span style={{ textAlign: "center" }}>PLAN</span>
            <span style={{ textAlign: "center" }}>REAL</span>
            <span style={{ textAlign: "center" }}>DIF</span>
          </div>
          {rows.map((r, i) => {
            const lt = r.diff > 0, el = r.diff < 0;
            const dc = lt ? "#EF4444" : el ? "#4ADE80" : "rgba(255,255,255,0.4)";
            const ds = r.diff === 0 ? "00:00" : lt ? `+${fmt(r.diff)}` : `−${fmt(-r.diff)}`;
            const isHighlight = r.isEnt || r.isPb || r.isCp;
            const bl = r.isEnt ? th.accent : r.isPb ? "#818CF8" : r.isCp ? "#F59E0B" : lt ? "#EF4444" : el ? "#4ADE80" : "rgba(255,255,255,0.15)";
            const rowBg = r.isEnt
              ? "rgba(74,222,128,0.08)"
              : r.isPb
                ? "rgba(129,140,248,0.08)"
                : r.isCp
                  ? "rgba(245,158,11,0.08)"
                  : lt
                    ? "rgba(239,68,68,0.05)"
                    : el
                      ? "rgba(74,222,128,0.04)"
                      : "rgba(255,255,255,0.025)";
            const rowBdr = isHighlight
              ? `1px solid ${bl}44`
              : "1px solid rgba(255,255,255,0.04)";
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 42px 42px 42px", gap: 4, alignItems: "center", background: rowBg, borderRadius: 7, borderLeft: `3px solid ${bl}`, borderTop: rowBdr, borderRight: rowBdr, borderBottom: rowBdr, padding: "5px 7px", marginTop: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: bl, flexShrink: 0 }} />
                  <span style={{ fontSize: 9.5, fontWeight: isHighlight ? 700 : 500, color: isHighlight ? "#FFFFFF" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{r.plan}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: lt ? "#EF4444" : el ? "#4ADE80" : "#FFFFFF", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{r.real}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: dc, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{ds}</span>
              </div>
            );
          })}

          {penalty && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, fontSize: 9.5, fontWeight: 700, color: "#F59E0B" }}>
              PENALIDAD ESTIMADA: USD {penalty} ({fmtDur(cmDelta)} demora)
            </div>
          )}

          {obs && (
            <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 9.5, color: "rgba(255,255,255,0.75)" }}>
              <b style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, letterSpacing: "1px" }}>OBSERVACIONES:</b> {obs}
            </div>
          )}

          {/* Sello de Auditoría y Footer */}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: clComplete ? "#4ADE80" : "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
              {clComplete ? "✓ CHECKLIST 100% VERIFICADO" : `CHECKLIST: ${clChecked}/${al.checklist.length}`}
            </span>
            <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px" }}>TAT MONITOR PRO · wsaico.com</span>
          </div>
        </div>
      </div>

      {/* IMAGE OVERLAY */}
      {ov && (
        <div className="OV" onClick={() => setOv(null)}>
          <img src={ov} className="OV-img" onClick={e => e.stopPropagation()} />
          <div className="OV-row" onClick={e => e.stopPropagation()}>
            <button className="OV-shr" style={{ background: "#25D366", color: "#fff" }} onClick={async () => { setOv(null); setShowWA(true); }}>
              {Ic.wa} WhatsApp
            </button>
            <button className="OV-shr" style={{ background: th.accent, color: "#052E16" }} onClick={doShareImg}>
              {Ic.share} Compartir imagen
            </button>
          </div>
          <button className="OV-cls" onClick={() => setOv(null)}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

/* ════════════════ ROOT ════════════════ */
export default function App() {
  const [ak, setAk] = useState(null);
  const al = ak ? AL[ak] : null;
  const isDur = al?.mode === "duration";
  return (
    <>
      <style>{CSS}</style>
      {!al
        ? <Login onLogin={setAk} />
        : isDur
          ? <CalcDur airlineKey={ak} onLogout={() => setAk(null)} />
          : <Calc    airlineKey={ak} onLogout={() => setAk(null)} />
      }
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
html{
  font-size:16px;
  -webkit-text-size-adjust:100%;
  background:#03060F;
}
body,#root{
  background:#03060F;
  color:#fff;
  font-family:'Plus Jakarta Sans',sans-serif;
  -webkit-font-smoothing:antialiased;
  width:100%;
  min-height:100%;
}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes rIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}

/* ══════════════ LOGIN ══════════════ */
.L{
  min-height:100vh;
  min-height:100dvh;
  width:100%;
  background:#0A0F1D;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  color:#fff;
}
.L-box{
  width:100%;
  max-width:420px;
  background:#131B2E;
  border:1px solid #1E293B;
  border-radius:22px;
  padding:32px 20px 24px;
  box-shadow:0 20px 40px rgba(0,0,0,0.5);
}
.L-hdr{text-align:center;margin-bottom:26px;}
.L-ico{width:48px;height:48px;border-radius:14px;background:#1E293B;border:1px solid #334155;display:inline-flex;align-items:center;justify-content:center;color:#38BDF8;margin-bottom:12px;}
.L-title{font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin:0 0 6px;}
.L-sub{font-size:13px;color:#94A3B8;margin:0;font-weight:500;}
.L-options{display:flex;flex-direction:column;gap:10px;margin-bottom:20px;}
.L-opt-btn{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#1A2338;border:1px solid #283550;border-radius:12px;color:#fff;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;transition:all .15s;}
.L-opt-btn:hover{background:#23304C;border-color:#38BDF8;transform:translateY(-1px);}
.L-opt-btn:active{transform:scale(0.98);}
.L-opt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.L-opt-name{flex:1;text-align:left;}
.L-opt-arrow{color:#64748B;font-size:16px;}

.L-fo{text-align:center;margin-top:24px;font-size:11px;color:#64748B;display:flex;align-items:center;justify-content:center;gap:4px;}
.L-fo a{color:#94A3B8;text-decoration:none;font-weight:600;}

/* APP CONTENEDOR PRINCIPAL - 100% RESPONSIVE SMARTPHONE Y DESKTOP */
.A{
  width:100%;
  max-width:100%;
  margin:0 auto;
  min-height:100vh;
  min-height:100dvh;
  display:flex;
  flex-direction:column;
  transition:background .3s;
  position:relative;
}
@media (min-width: 640px) {
  .A {
    max-width: 480px;
    box-shadow: 0 0 50px rgba(0,0,0,0.6);
  }
}

.N{
  min-height:52px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding-top:max(8px, env(safe-area-inset-top));
  padding-bottom:8px;
  padding-left:max(14px, env(safe-area-inset-left));
  padding-right:max(14px, env(safe-area-inset-right));
  flex-shrink:0;
  width:100%;
}
.N-l{display:flex;align-items:center;gap:7px;}
.N-nm{font-size:15px;font-weight:800;color:#fff;letter-spacing:-0.3px;}
.N-r{display:flex;align-items:center;gap:6px;}
.N-cd{font-size:10px;font-weight:700;letter-spacing:2px;}
.N-out{background:rgba(255,255,255,0.08);border:none;border-radius:7px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.4);}
.N-ico-btn{background:rgba(255,255,255,0.06);border:none;border-radius:7px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.5);position:relative;}
.N-badge{position:absolute;top:-4px;right:-4px;background:#EF4444;color:#fff;border-radius:10px;font-size:8px;font-weight:700;padding:1px 4px;font-family:'Plus Jakarta Sans',sans-serif;min-width:15px;text-align:center;}

/* HERO */
.H{
  padding-top:10px;
  padding-bottom:10px;
  padding-left:max(12px, env(safe-area-inset-left));
  padding-right:max(12px, env(safe-area-inset-right));
  flex-shrink:0;
  width:100%;
}
.H-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:rgba(0,0,0,0.32);padding:4px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);margin-bottom:8px;}
.H-mode-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 0;border-radius:9px;border:none;background:transparent;color:rgba(255,255,255,0.7);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;}
.H-mode-btn.active{font-weight:800;box-shadow:0 2px 10px rgba(0,0,0,0.3);}
.H-msg{display:flex;align-items:center;gap:7px;border-radius:10px;padding:8px 11px;margin-bottom:8px;}
.H-inp-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}
.H-inp-card{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:9px 8px 6px;display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;}
.H-inp-lbl{font-size:8px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,0.4);}
.H-inp-sub{font-size:7.5px;color:rgba(255,255,255,0.2);}
.H-quick-row{display:flex;gap:4px;width:100%;margin-top:5px;}
.H-quick-btn{flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:4px 0;font-family:'Plus Jakarta Sans',sans-serif;font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.7);cursor:pointer;transition:all .12s;text-align:center;}
.H-quick-btn:hover{background:rgba(255,255,255,0.18);color:#fff;}
.H-quick-btn:active{transform:scale(0.92);}
.H-quick-now{background:rgba(255,255,255,0.18);color:#fff;font-weight:800;border-color:rgba(255,255,255,0.25);}
.H-cd{display:flex;align-items:center;gap:10px;border-radius:12px;border:1px solid;padding:10px 12px;margin-bottom:7px;transition:all .3s;}
.H-cd-u{animation:cdpulse 1.1s ease-in-out infinite;}
@keyframes cdpulse{0%,100%{opacity:1;}50%{opacity:0.65;}}

/* LIST */
.ML{
  padding-top:4px;
  padding-bottom:6px;
  padding-left:max(10px, env(safe-area-inset-left));
  padding-right:max(10px, env(safe-area-inset-right));
  width:100%;
}

/* MODALS */
.MOD{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(8px);}
.MOD-box{
  width:100%;
  max-width:100%;
  border-radius:20px 20px 0 0;
  padding-top:20px;
  padding-left:max(18px, env(safe-area-inset-left));
  padding-right:max(18px, env(safe-area-inset-right));
  padding-bottom:max(24px, env(safe-area-inset-bottom));
  max-height:85vh;
  max-height:85dvh;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
}
@media (min-width: 640px) {
  .MOD-box {
    max-width: 480px;
    border-radius: 20px;
    margin-bottom: 24px;
  }
}

/* FOOTER */
.F{text-align:center;padding:5px 16px 1px;font-size:11px;display:flex;align-items:center;justify-content:center;gap:4px;}
.F a{text-decoration:none;font-weight:600;opacity:0.6;}

/* BOTTOM BAR */
.B{
  border-top:1px solid;
  padding-top:8px;
  padding-left:max(12px, env(safe-area-inset-left));
  padding-right:max(12px, env(safe-area-inset-right));
  padding-bottom:max(14px, env(safe-area-inset-bottom));
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:4px;
  position:sticky;
  bottom:0;
  z-index:10;
  box-shadow:0 -2px 14px rgba(0,0,0,0.1);
  width:100%;
  background:inherit;
}
.B-btn{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:9.5px;font-weight:600;padding:4px 6px;border-radius:8px;position:relative;white-space:nowrap;}
.B-btn:active{transform:scale(0.9);}
.B-fab{width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;margin-top:-14px;box-shadow:0 5px 18px rgba(0,0,0,0.25);flex-shrink:0;}
.B-fab:active{transform:scale(0.91);}

/* OVERLAY */
.OV{position:fixed;inset:0;z-index:200;background:rgba(6,10,18,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;backdrop-filter:blur(12px);}
.OV-img{max-width:92vw;max-height:65vh;object-fit:contain;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.6);}
.OV-row{display:flex;gap:10px;width:100%;max-width:320px;}
.OV-shr{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:13px 0;border-radius:14px;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;}
.OV-cls{padding:11px 22px;border-radius:28px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;color:rgba(255,255,255,0.45);}

#cap,#cap-dur{position:absolute;left:-9999px;top:0;width:390px;overflow:hidden;}
`;
