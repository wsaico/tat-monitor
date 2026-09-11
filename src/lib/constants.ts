export type AircraftType = 'remolque' | 'autopropulsado';

export interface Process {
  id: string;
  name: string;
  offset: number;
  critical?: boolean;
  highlight?: boolean;
}

export interface AircraftConfig {
  tatTarget: number;
  processes: Process[];
}

export const PROCESS_CONFIGS: Record<AircraftType, AircraftConfig> = {
  remolque: {
    tatTarget: 35,
    processes: [
      { id: 'motorCut', name: 'Corte Motor', offset: -35, critical: true },
      { id: 'doorsOpen', name: 'Apertura Puertas', offset: -33 },
      { id: 'disembarkEnd', name: 'Fin Desembarque', offset: -25 },
      { id: 'cleanStart', name: 'Inicio Limpieza', offset: -25 },
      { id: 'cleanEnd', name: 'Fin Limpieza', offset: -21 },
      { id: 'preBoard', name: 'Pre-Embarque', offset: -27 },
      { id: 'boardingCall', name: 'Embarque Sala', offset: -23 },
      { id: 'baggageSearch', name: 'Búsqueda Equipaje', offset: -14 },
      { id: 'flightDelivery', name: 'Entrega de Vuelo', offset: -12, critical: true, highlight: true },
      { id: 'lastPax', name: 'Último Pasajero', offset: -10, critical: true },
      { id: 'accommodation', name: 'Acomodación PAX', offset: -7 },
      { id: 'doorsClosed', name: 'Cierre de Puertas', offset: -7, critical: true, highlight: true },
      { id: 'engineStart', name: 'Encendido Motor', offset: -7 },
      { id: 'pushBack', name: 'Push Back', offset: 0, critical: true },
      { id: 'etd', name: 'ETD', offset: 0, critical: true },
    ],
  },
  autopropulsado: {
    tatTarget: 40,
    processes: [
      { id: 'motorCut', name: 'Corte Motor', offset: -40, critical: true },
      { id: 'doorsOpen', name: 'Apertura Puertas', offset: -38 },
      { id: 'disembarkEnd', name: 'Fin Desembarque', offset: -30 },
      { id: 'cleanStart', name: 'Inicio Limpieza', offset: -30 },
      { id: 'cleanEnd', name: 'Fin Limpieza', offset: -26 },
      { id: 'preBoard', name: 'Pre-Embarque', offset: -32 },
      { id: 'boardingCall', name: 'Embarque Sala', offset: -28 },
      { id: 'baggageSearch', name: 'Búsqueda Equipaje', offset: -19 },
      { id: 'flightDelivery', name: 'Entrega de Vuelo', offset: -17, critical: true, highlight: true },
      { id: 'lastPax', name: 'Último Pasajero', offset: -15, critical: true },
      { id: 'accommodation', name: 'Acomodación PAX', offset: -12 },
      { id: 'doorsClosed', name: 'Cierre de Puertas', offset: -12, critical: true, highlight: true },
      { id: 'engineStart', name: 'Encendido Motor', offset: -12 },
      { id: 'pushBack', name: 'Push Back', offset: -5, critical: true },
      { id: 'etd', name: 'ETD', offset: 0, critical: true },
    ],
  },
};
