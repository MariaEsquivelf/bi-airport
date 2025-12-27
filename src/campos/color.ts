import * as d3 from "d3";
import { ParsedData, FlightRow } from "../model";

// Colores profesionales similares a la imagen de referencia
const AIRLINE_COLORS: { [key: string]: string } = {
  "UA": "#4A90E2",      // Azul United Airlines
  "AA": "#0078D2",      // Azul American Airlines
  "DL": "#C8102E",      // Rojo Delta
  "WN": "#304CB2",      // Azul Southwest
  "B6": "#002F6C",      // Azul oscuro JetBlue
  "NK": "#FFC600",      // Amarillo Spirit
  "F9": "#00A859",      // Verde Frontier
  "AS": "#01426A",      // Azul Alaska
  "default": "#5B9BD5"  // Azul por defecto
};

const STATUS_COLORS: { [key: string]: string } = {
  "on-time": "#5CB85C",     // Verde - a tiempo
  "delayed": "#F0AD4E",     // Naranja - retrasado
  "cancelled": "#D9534F",   // Rojo - cancelado
  "estimated": "#5BC0DE",   // Azul claro - estimado
  "default": "#5B9BD5"      // Azul por defecto
};

export function buildColorScale(
  data: ParsedData, 
  colorDimension: string = "actualColor"
): d3.ScaleOrdinal<string, string> {
  const getDimensionValue = (row: FlightRow): string | null => {
    switch (colorDimension) {
      case "airline": return row.airline;
      case "domesticIntl": return row.domesticIntl;
      case "aircraftModel": return row.aircraftModel;
      case "terminal": return row.terminal;
      case "actualColor":
      default: return row.actualColor;
    }
  };

  const keys = data.rows
    .map(d => getDimensionValue(d))
    .filter((v): v is string => !!v);

  const domain = Array.from(new Set(keys));

  // Usar colores basados en aerolíneas si el dimension es actualColor o airline
  if (colorDimension === "actualColor" || colorDimension === "airline") {
    return d3.scaleOrdinal<string, string>()
      .domain(domain)
      .range(domain.map(key => AIRLINE_COLORS[key] || AIRLINE_COLORS["default"]));
  }

  // Para otras dimensiones, usar esquema de colores categórico
  return d3.scaleOrdinal<string, string>()
    .domain(domain)
    .range(d3.schemeTableau10);
}

export function getColorKey(row: FlightRow, colorDimension: string = "actualColor"): string {
  switch (colorDimension) {
    case "airline": return row.airline ?? "default";
    case "domesticIntl": return row.domesticIntl ?? "default";
    case "aircraftModel": return row.aircraftModel ?? "default";
    case "terminal": return row.terminal ?? "default";
    case "actualColor":
    default: return row.actualColor ?? "default";
  }
}

// Helper para determinar el color basado en el estado del vuelo
export function getStatusColor(row: FlightRow): string {
  // Si tiene scheduled y actual, comparar para ver si hay retraso
  if (row.scheduledStart && row.actualStart) {
    const delay = row.actualStart.getTime() - row.scheduledStart.getTime();
    if (delay > 15 * 60 * 1000) return STATUS_COLORS["delayed"]; // >15 min
    if (delay < -5 * 60 * 1000) return STATUS_COLORS["on-time"];  // Early
    return STATUS_COLORS["on-time"];
  }
  
  // Si solo tiene estimated tow times
  if (row.towOnStatus?.toLowerCase().includes("estimated") || 
      row.towOffStatus?.toLowerCase().includes("estimated")) {
    return STATUS_COLORS["estimated"];
  }
  
  return STATUS_COLORS["default"];
}
