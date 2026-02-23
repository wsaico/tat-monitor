'use client';

import { useState, useEffect, useCallback } from 'react';

/* ─── TIME UTILS (Ported from TATCalculator.jsx) ────────────────── */
export const toMins = (t: string) => {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return h * 60 + (m || 0);
};

export const addMins = (t: string, d: number) => {
    const v = ((toMins(t) + d) % 1440 + 1440) % 1440;
    return `${pad2(Math.floor(v / 60))}:${pad2(v % 60)}`;
};

export const sub = (a: string, b: string) => toMins(b) - toMins(a); // + atraso, - adelanto
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const fmt = (m: number) => {
    const a = Math.abs(m);
    return `${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
};

export const isValidTime = (t: string) => /^\d{2}:\d{2}$/.test(t) && +t.split(":")[0] < 24 && +t.split(":")[1] < 60;

export const nowHHMM = () => {
    const n = new Date();
    return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`;
};

export const fmtMSS = (s: number, forcePlus = false) => {
    const isNeg = s < 0;
    const abs = Math.abs(s);
    const m = Math.floor(abs / 60);
    const sec = abs % 60;
    const sign = isNeg ? '-' : (forcePlus ? '+' : '');
    return `${sign}${pad2(m)}:${pad2(sec)}`;
};

/* ─── AIRLINE CONFIGS ───────────────────────────────────────────── */
export interface MilestoneConfig {
    label: string;
    planOff: number;
    isFirst?: boolean;
    isEnt?: boolean;
    isPb?: boolean;
}

export interface AirlineTheme {
    nav: string;
    gradA: string;
    gradB: string;
    accent: string;
}

export interface AirlineConfig {
    name: string;
    code: string;
    theme: AirlineTheme;
    tat: number;
    ms: MilestoneConfig[];
}

export const AL: Record<string, AirlineConfig> = {
    SKY: {
        name: "SKY Airline", code: "SKY",
        theme: { nav: "#0F2A5C", gradA: "#1B3A6B", gradB: "#2563EB", accent: "#4ADE80" },
        tat: 35,
        ms: [
            { label: "Corte Motor (CM)", planOff: 0, isFirst: true },
            { label: "Apertura de puerta", planOff: 2 },
            { label: "Inicio de desembarque", planOff: 2 },
            { label: "Fin de desembarque", planOff: 10 },
            { label: "Inicio de limpieza", planOff: 10 },
            { label: "Inicio de embarque en sala", planOff: 11 },
            { label: "Fin de limpieza", planOff: 14 },
            { label: "Ingreso primer pasajero", planOff: 14 },
            { label: "Activación búsqueda equipajes", planOff: 20 },
            { label: "Confirmación equipajes", planOff: 28 },
            { label: "Entrega de vuelo", planOff: 28, isEnt: true },
            { label: "Fin de embarque — último pax", planOff: 29 },
            { label: "Fin de acomodación abordo", planOff: 33 },
            { label: "Cierre de puertas", planOff: 33 },
            { label: "Push back", planOff: 35, isPb: true },
        ],
    },
    LATAM: {
        name: "LATAM Airlines", code: "LATAM",
        theme: { nav: "#1A1A2E", gradA: "#1A1A2E", gradB: "#0F3460", accent: "#E2B14A" },
        tat: 35,
        ms: [
            { label: "AVIÓN EN PEA", planOff: -2 },
            { label: "COLOCAR EL CORTE DE MOTOR REAL", planOff: 0, isFirst: true },
            { label: "AP E INICIO DESEMBARQUE", planOff: 2 },
            { label: "FIN DESEMBARQUE", planOff: 10 },
            { label: "INICIO LIMPIEZA", planOff: 10 },
            { label: "FIN LIMPIEZA", planOff: 14 },
            { label: "PRE-EMBARQUE", planOff: 8 },
            { label: "EMBARQUE SALA", planOff: 12 },
            { label: "BÚSQUEDA EQUIPAJE", planOff: 21 },
            { label: "ENTREGA DE VUELO (LLAMADA A CTA)", planOff: 23, isEnt: true },
            { label: "LLEGADA DEL ÚLTIMO PAX AL AVIÓN", planOff: 25 },
            { label: "ACOMODACIÓN PASAJEROS", planOff: 28 },
            { label: "CIERRE PUERTAS Y CB", planOff: 28 },
            { label: "ENCIENDE MOTOR", planOff: 28 },
            { label: "PUSH BACK", planOff: 35, isPb: true },
        ],
    },
};

const STORAGE_KEY = 'tat_calculator_v2_state';

export const useTATLogic = (airlineKey: string | null) => {
    const al = airlineKey ? AL[airlineKey] : null;

    const [etdItin, setEtdItin] = useState('');
    const [cmReal, setCmReal] = useState('');
    const [flightNum, setFlightNum] = useState('');
    const [isHydrated, setIsHydrated] = useState(false);

    // Real-time metrics
    // Real-time metrics
    const [groundTime, setGroundTime] = useState(0);
    const [deliveryCountdown, setDeliveryCountdown] = useState<number | null>(null);
    const [tigSeconds, setTigSeconds] = useState(0);
    const [pbSeconds, setPbSeconds] = useState<number | null>(null);
    const [deliveryTarget, setDeliveryTarget] = useState(45);

    const cmPlan = al ? addMins(etdItin, -al.tat) : '';
    const cmDelta = (al && etdItin && cmReal) ? sub(cmPlan, cmReal) : 0;

    const rows = al ? al.ms.map(m => {
        const plan = addMins(cmPlan, m.planOff);
        const real = addMins(cmReal, m.planOff);
        const diff = sub(plan, real);

        // Gantt offset is (planOff - tat)
        const go = m.planOff - al.tat;
        const gantt = (m.label === "AVIÓN EN PEA") ? "-" : (go === 0 ? "0" : String(go));

        return { ...m, plan, real, diff, gantt };
    }) : [];

    // Initial state setup
    useEffect(() => {
        if (!al) return;

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.airline === airlineKey) {
                    setEtdItin(data.etdItin || '');
                    setCmReal(data.cmReal || '');
                    setFlightNum(data.flightNum || '');
                    setAlertAt(data.alertAt ?? 5);
                    setDark(!!data.dark);
                    setDeliveryTarget(data.deliveryTarget ?? 45);
                    setIsHydrated(true);
                    return;
                }
            } catch (e) {
                console.error('Failed to restore state', e);
            }
        }

        const now = nowHHMM();
        const defETD = addMins(now, al.tat);
        const defCM = now;
        setEtdItin(defETD);
        setCmReal(defCM);
        setIsHydrated(true);
    }, [airlineKey, al]);

    const [alertAt, setAlertAt] = useState(5);
    const [dark, setDark] = useState(false);

    // Persistence
    useEffect(() => {
        if (!isHydrated || !airlineKey) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            airline: airlineKey,
            etdItin,
            cmReal,
            flightNum,
            alertAt,
            dark,
            deliveryTarget
        }));
    }, [etdItin, cmReal, flightNum, airlineKey, isHydrated, alertAt, dark, deliveryTarget]);

    // Update real-time metrics every 10 seconds
    useEffect(() => {
        if (!cmReal || !al) {
            setGroundTime(0);
            setDeliveryCountdown(null);
            return;
        }

        const update = () => {
            const now = new Date();

            const getTodayTime = (hhmm: string) => {
                const [h, m] = hhmm.split(":").map(Number);
                const d = new Date(now);
                d.setHours(h, m, 0, 0);
                d.setSeconds(0, 0);
                return d;
            };

            const cmDate = getTodayTime(cmReal);

            if (cmDate.getTime() - now.getTime() > 12 * 3600000) {
                cmDate.setDate(cmDate.getDate() - 1);
            }
            else if (now.getTime() - cmDate.getTime() > 20 * 3600000) {
                cmDate.setDate(cmDate.getDate() + 1);
            }

            const diffSecs = Math.floor((now.getTime() - cmDate.getTime()) / 1000);
            const ts = diffSecs >= 0 ? diffSecs : 0;
            setTigSeconds(ts);
            setGroundTime(Math.floor(ts / 60));

            const pbRow = rows.find(r => r.isPb);
            if (pbRow && pbRow.real) {
                const pbDate = getTodayTime(pbRow.real);
                if (pbDate.getTime() > cmDate.getTime() + 24 * 3600000) pbDate.setDate(pbDate.getDate() - 1);
                if (pbDate.getTime() < cmDate.getTime() - 24 * 3600000) pbDate.setDate(pbDate.getDate() + 1);
                if (pbDate.getTime() < cmDate.getTime()) pbDate.setDate(pbDate.getDate() + 1);

                const cdSecs = Math.floor((pbDate.getTime() - now.getTime()) / 1000);
                setPbSeconds(cdSecs);
                setDeliveryCountdown(Math.floor(cdSecs / 60));
            }
        };

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [cmReal, rows, al]);

    const resetData = useCallback(() => {
        if (!al) return;
        const now = nowHHMM();
        const defETD = addMins(now, al.tat);
        const defCM = now;
        setEtdItin(defETD);
        setCmReal(defCM);
    }, [al]);

    return {
        etdItin,
        setEtdItin,
        cmReal,
        setCmReal,
        cmPlan,
        cmDelta,
        rows,
        resetData,
        alertAt,
        setAlertAt,
        dark,
        setDark,
        al,
        flightNum,
        setFlightNum,
        groundTime,
        deliveryCountdown,
        tigSeconds,
        pbSeconds,
        deliveryTarget,
        setDeliveryTarget
    };
};
