'use client';

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTATLogic, AL, isValidTime, pad2, fmt, sub } from '@/hooks/useTATLogic';

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
    rows, resetData, al
  } = useTATLogic(airlineKey);

  const [ov, setOv] = useState<string | null>(null);
  const capRef = useRef<HTMLDivElement>(null);

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

  if (!al) return null;
  const th = al.theme;

  const entRow = rows.find(r => r.isEnt);
  const pbRow = rows.find(r => r.isPb);

  // Estado de mensaje inteligente
  const isEarly = cmDelta < 0;
  const isExact = cmDelta === 0;

  const msgData = (() => {
    if (!pbRow || !entRow) return { type: "ok", msg: "" };
    if (isExact) return {
      type: "ok",
      msg: `Vuelo puntual. Objetivo: Cumplir hitos para Entrega a las ${entRow.real} y Push back ${pbRow.real}.`,
    };
    if (isEarly) return {
      type: "ok",
      msg: `Avión adelantado ${fmt(-cmDelta)}. ¡No esperes al ETD! Objetivo: Entrega anticipada ${entRow.real} y salida a las ${pbRow.real}.`,
    };
    return {
      type: "late",
      msg: `Llegada tardía (+${fmt(cmDelta)}). Foco en recuperación: Entrega límite ${entRow.plan} para Push back a las ${pbRow.real}.`,
    };
  })();

  const SC = msgData.type === "ok" ? "#4ADE80" : "#EF4444";
  const SBg = msgData.type === "ok" ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)";
  const SBr = msgData.type === "ok" ? "rgba(74,222,128,0.22)" : "rgba(239,68,68,0.22)";


  return (
    <div className="A">
      {/* NAV */}
      <nav className="N" style={{ background: th.nav }}>
        <div className="N-l">
          <span style={{ color: th.accent, display: "flex" }}>{Ic.plane}</span>
          <span className="N-nm">TAT Calculator</span>
        </div>
        <div className="N-r">
          <span className="N-cd" style={{ color: th.accent }}>{al.code}</span>
          <button className="N-out" onClick={onLogout}>{Ic.logout}</button>
        </div>
      </nav>

      {/* HERO */}
      <div className="H" style={{ background: `linear-gradient(160deg,${th.gradA},${th.gradB})` }}>
        <div className="H-msg" style={{ background: SBg, border: `1px solid ${SBr}`, color: SC }}>
          <span style={{ display: "flex", flexShrink: 0 }}>{msgData.type === "ok" ? Ic.ok : Ic.warn}</span>
          <span className="H-msg-t">{msgData.msg}</span>
        </div>

        <div className="H-inp-row">
          <div className="H-inp-card H-inp-card--primary" onClick={() => (document.querySelector('.H-inp-card--primary input') as any)?.focus()}>
            <div className="H-inp-top">
              <span className="H-inp-lbl">CM REAL Operativo</span>
              <span className="H-edit">{Ic.edit}</span>
            </div>
            <TI value={cmReal} onChange={setCmReal} color="#fff" size={32} />
            <span className="H-inp-sub">CORTE DE MOTOR</span>
          </div>
        </div>

        <div className="H-sub-row">
          <div className="H-inp-card H-inp-card--secondary"
            style={{ borderColor: `${th.accent}30` }}
            onClick={() => (document.querySelector('.H-inp-card--secondary input') as any)?.focus()}>
            <div className="H-inp-top">
              <span className="H-inp-lbl" style={{ color: `${th.accent}80` }}>ETD. Itin.</span>
              <span className="H-edit" style={{ color: `${th.accent}60` }}>{Ic.edit}</span>
            </div>
            <TI value={etdItin} onChange={setEtdItin} color={th.accent} size={20} />
          </div>

          <div className="H-grid">
            <div className="H-card">
              <span className="H-cl" style={{ color: th.accent }}>PROY. ENTREGA</span>
              <span className="H-cv" style={{ color: th.accent }}>{entRow?.real || '--:--'}</span>
            </div>
            <div className="H-card">
              <span className="H-cl" style={{ color: th.accent }}>PROY. PUSHBACK</span>
              <span className="H-cv" style={{ color: th.accent }}>{pbRow?.real || '--:--'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE HEADER */}
      <div className="TH">
        <span>HITOS OPERATIVOS</span>
        <span style={{ textAlign: "center", color: th.accent }}>PROYECCIÓN</span>
        <span style={{ textAlign: "center" }} className="TH-dim">ITINERARIO</span>
        <span style={{ textAlign: "center" }}>DIF</span>
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
              <span className="MR-t" style={{ color: dc, fontWeight: 700 }}>{ds}</span>
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
      <div className="B">
        <button className="B-btn" onClick={resetData}>
          {Ic.reset}<span>Reiniciar</span>
        </button>
        <button className="B-fab" style={{ background: `linear-gradient(135deg,${th.gradA},${th.gradB})` }} onClick={capture}>
          {Ic.cam}
        </button>
        <button className="B-btn" style={{ color: th.accent }} onClick={capture}>
          {Ic.share}<span>Compartir</span>
        </button>
      </div>

      {/* CAPTURE MASK */}
      <div id="cap" ref={capRef}>
        <div style={{ background: `linear-gradient(160deg,${th.gradA},${th.gradB})`, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>{al.name} · TAT Calculator</div>
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
            <span>HITO</span><span style={{ textAlign: "center" }}>PROYEC.</span><span style={{ textAlign: "center", opacity: 0.5 }}>ITIN.</span><span style={{ textAlign: "center" }}>DIF</span>
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
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: dc, textAlign: "center" }}>{ds}</span>
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
    if (busy || !pass.trim()) return;
    setErr(""); setBusy(true);
    setTimeout(() => {
      const k = pass.trim().toUpperCase();
      if (k === "SKY" || k === "LATAM") { onLogin(k); return; }
      setBusy(false); setErr("Código no reconocido.");
    }, 500);
  };

  return (
    <div className="L">
      <div className="L-grid" /><div className="L-g1" /><div className="L-g2" />
      <div className="L-wrap">
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
