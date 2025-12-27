// model.ts

export interface FlightRow {
  gate: string;
  parentGate: string | null; // For wide-body aircraft that span multiple gates
  actualColor: string | null;

  groundStart: Date | null;
  groundEnd: Date | null;
  
  // For stacked bar visualization (Req 4e)
  landedTime: Date | null;      // Aircraft landed timestamp
  operationTime: Date | null;    // Operations start timestamp (between landed and ground end)

  scheduledStart: Date | null;
  scheduledEnd: Date | null;

  actualStart: Date | null;
  actualEnd: Date | null;

  towOff: Date | null;
  towOffStatus: string | null;

  towOn: Date | null;
  towOnStatus: string | null;

  actualText: string;

  // Additional fields for tooltips and filtering
  airline: string | null;
  flightNumber: string | null;
  tailNumber: string | null;
  aircraftModel: string | null;
  turnId: string | null;
  turnDuration: string | null;
  terminal: string | null;
  domesticIntl: string | null;
  
  // For tooltip: store any additional columns
  tooltipFields: Array<{ name: string; value: any }>;
  
  // For selection support
  identity?: powerbi.visuals.ISelectionId;
}

export interface ParsedData {
  rows: FlightRow[];
  gates: string[];
  timeDomain: [Date, Date];
}

export function parseDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

import powerbi from "powerbi-visuals-api";
