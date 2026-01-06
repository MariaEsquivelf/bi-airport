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

  // Already a Date instance
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Numeric timestamp
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Support DD/MM/YYYY HH:mm[:ss] (or DD/MM/YYYY without time)
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const match = str.match(ddmmyyyy);
  if (match) {
    const [, ddStr, mmStr, yyyyStr, hhStr, minStr, ssStr] = match;
    const dd = parseInt(ddStr, 10);
    const mm = parseInt(mmStr, 10) - 1; // month is 0-based
    const yyyy = parseInt(yyyyStr, 10);
    const hh = hhStr ? parseInt(hhStr, 10) : 0;
    const min = minStr ? parseInt(minStr, 10) : 0;
    const ss = ssStr ? parseInt(ssStr, 10) : 0;

    const d = new Date(yyyy, mm, dd, hh, min, ss, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback to native parsing for other formats
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

import powerbi from "powerbi-visuals-api";
