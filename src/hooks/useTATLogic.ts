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
            { label: "Corte Motor", planOff: 0, isFirst: true },
            { label: "Apertura Puertas", planOff: 2 },
            { label: "Fin Desembarque", planOff: 10 },
            { label: "Inicio Limpieza", planOff: 10 },
            { label: "Fin Limpieza", planOff: 14 },
            { label: "Pre-Embarque", planOff: 8 },
            { label: "Embarque Sala", planOff: 12 },
            { label: "Búsqueda Equipaje", planOff: 21 },
            { label: "Entrega de Vuelo", planOff: 23, isEnt: true },
            { label: "Último Pasajero", planOff: 25 },
            { label: "Acomodación PAX", planOff: 28 },
            { label: "Cierre de Puertas", planOff: 28 },
            { label: "Encendido Motor", planOff: 28 },
            { label: "Push Back", planOff: 35, isPb: true },
        ],
    },
};

const STORAGE_KEY = 'tat_calculator_v2_state';

export const useTATLogic = (airlineKey: string | null) => {
    const al = airlineKey ? AL[airlineKey] : null;

    const [etdItin, setEtdItin] = useState('');
    const [cmReal, setCmReal] = useState('');
    const [isHydrated, setIsHydrated] = useState(false);

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
                    setIsHydrated(true);
                    return;
                }
            } catch (e) {
                console.error('Failed to restore state', e);
            }
        }

        const now = nowHHMM();
        const defETD = addMins(now, 40);
        const defCM = addMins(defETD, -al.tat);
        setEtdItin(defETD);
        setCmReal(defCM);
        setIsHydrated(true);
    }, [airlineKey, al]);

    // Persistence
    useEffect(() => {
        if (!isHydrated || !airlineKey) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            airline: airlineKey,
            etdItin,
            cmReal
        }));
    }, [etdItin, cmReal, airlineKey, isHydrated]);

    const resetData = useCallback(() => {
        if (!al) return;
        const now = nowHHMM();
        const defETD = addMins(now, 40);
        const defCM = addMins(defETD, -al.tat);
        setEtdItin(defETD);
        setCmReal(defCM);
    }, [al]);

    const cmPlan = al ? addMins(etdItin, -al.tat) : '';
    const cmDelta = (al && etdItin && cmReal) ? sub(cmPlan, cmReal) : 0;

    const rows = al ? al.ms.map(m => {
        const plan = addMins(cmPlan, m.planOff);
        const real = addMins(cmReal, m.planOff);
        const diff = sub(plan, real);
        return { ...m, plan, real, diff };
    }) : [];

    return {
        etdItin,
        setEtdItin,
        cmReal,
        setCmReal,
        cmPlan,
        cmDelta,
        rows,
        resetData,
        al
    };
};
