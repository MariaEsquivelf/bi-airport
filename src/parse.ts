import powerbi from "powerbi-visuals-api";
import { FlightRow, ParsedData, parseDate } from "./model";

export interface FilterCriteria {
  startDate: Date | null;
  endDate: Date | null;
  timeMin: number;
  timeMax: number;
  terminal: string;
  gate: string;
  airline: string;
  flightNumber: string;
  tail: string;
}

export function applyFilters(rows: FlightRow[], filters: FilterCriteria): FlightRow[] {

  const startMs = filters.startDate
    ? new Date(filters.startDate.getFullYear(), filters.startDate.getMonth(), filters.startDate.getDate(), 0, 0, 0, 0).getTime()
    : null;

  const endMs = filters.endDate
    ? new Date(filters.endDate.getFullYear(), filters.endDate.getMonth(), filters.endDate.getDate(), 23, 59, 59, 999).getTime()
    : null;

  return rows.filter(row => {
    // Filter by date (si está setear, comparar solo la fecha)
    if (filters.startDate || filters.endDate) {
      const rowDate =
  row.actualStart ||
  row.towOn ||
  row.scheduledStart ||
  row.groundStart ||
  row.actualEnd ||
  row.towOff ||
  row.scheduledEnd ||
  row.groundEnd;

if (!rowDate) return false; // si hay filtro de fecha, sin fecha NO entra

const rowMs = rowDate.getTime();

if (startMs !== null && rowMs < startMs) return false;
if (endMs !== null && rowMs > endMs) return false;

    }

    // NOTE: Time filter removed - now controls viewport instead of filtering rows

    // Filter by terminal
    if (filters.terminal && row.terminal && !row.terminal.toLowerCase().includes(filters.terminal.toLowerCase())) {
      return false;
    }

    // Filter by gate - include both gates for wide-body aircraft
    if (filters.gate) {
      const gateMatch = row.gate.toLowerCase().includes(filters.gate.toLowerCase());

      // If this row is part of a wide-body, also check if the filter matches the parent gate
      let parentGateMatch = false;
      if (row.parentGate) {
        parentGateMatch = row.parentGate.toLowerCase().includes(filters.gate.toLowerCase());
      }

      // Keep row if either the gate itself matches OR the parent gate matches
      if (!gateMatch && !parentGateMatch) {
        return false;
      }
    }

    // Filter by airline
    if (filters.airline) {
      // Try to get airline from airline field or use actualColor as fallback
      let airlineToCheck = row.airline;

      // If no airline field, use actualColor (which often contains airline code like UA, WN)
      if (!airlineToCheck && row.actualColor) {
        airlineToCheck = row.actualColor;
      }


      if (!airlineToCheck || !airlineToCheck.toLowerCase().includes(filters.airline.toLowerCase())) {
        return false;
      }
    }

    // Filter by flight number
    if (filters.flightNumber) {
      // Try to get flight number from flightNumber field or extract from actualText
      let flightNumberToCheck = row.flightNumber;

      // If no flightNumber field, try to extract from actualText (e.g., "UA 123/UA 36")
      if (!flightNumberToCheck && row.actualText) {
        flightNumberToCheck = row.actualText;
      }


      if (!flightNumberToCheck || !flightNumberToCheck.toLowerCase().includes(filters.flightNumber.toLowerCase())) {
        return false;
      }
    }

    // Filter by tail
    if (filters.tail) {
      if (!row.tailNumber || !row.tailNumber.toLowerCase().includes(filters.tail.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

export function parseDataView(
  dataView: powerbi.DataView,
  host: powerbi.extensibility.visual.IVisualHost
): ParsedData | null {
  if (!dataView.table || !dataView.table.rows) return null;

  const columns = dataView.table.columns;
  const rows = dataView.table.rows;

  // ✅ Mejor práctica: mapear por role (no por displayName)
  const colIndexByRole = (roleName: string): number =>
    columns.findIndex(c => (c.roles as any)?.[roleName]);

  // ✅ REQUISITO 2a-ii: Mapping de parent gates a child gates para wide-body aircraft
  // Lógica automática: si el gate termina en "W", ocupa 2 portones
  // Ejemplo: A17W ocupa A17 y A19 (el gate con el mismo número sin W, y el siguiente)
  // Ejemplo: A33W ocupa A33 y A35 (el gate base y el siguiente +2)

  // Helper function para calcular gates adyacentes
  const getAdjacentGates = (wideBodyGate: string): string[] | null => {
    if (!wideBodyGate.endsWith("W")) return null;

    // Remover la "W" para obtener el gate base
    const baseGate = wideBodyGate.slice(0, -1);

    // Extraer el prefijo de letra y el número
    const match = baseGate.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const prefix = match[1]; // e.g., "A"
    const gateNum = parseInt(match[2]); // e.g., 17

    // El wide-body ocupa el gate base y el siguiente (+2)
    // A17W -> A17 y A19
    // A33W -> A33 y A35
    // B39W -> B39 y B41
    const nextNum = gateNum + 2;
    const nextGate = `${prefix}${nextNum}`;

    return [baseGate, nextGate];
  };

  // Mappings manuales (sobrescriben la lógica automática si es necesario)
  const MANUAL_PARENT_TO_CHILDREN: Record<string, string[]> = {
    // Ejemplo: "A17W": ["A17", "A15"] si la lógica por defecto no aplica
  };

  const idx = {
    gate: colIndexByRole("gate"),
    parentGate: colIndexByRole("parentGate"),
    actualColor: colIndexByRole("actualColor"),
    groundStart: colIndexByRole("groundStart"),
    groundEnd: colIndexByRole("groundEnd"),
    landedTime: colIndexByRole("landedTime"),
    operationTime: colIndexByRole("operationTime"),
    scheduledStart: colIndexByRole("scheduledStart"),
    scheduledEnd: colIndexByRole("scheduledEnd"),
    actualStart: colIndexByRole("actualStart"),
    actualEnd: colIndexByRole("actualEnd"),
    towOff: colIndexByRole("towOff"),
    towOffStatus: colIndexByRole("towOffStatus"),
    towOn: colIndexByRole("towOn"),
    towOnStatus: colIndexByRole("towOnStatus"),
    actualText: colIndexByRole("actualText"),
    airline: colIndexByRole("airline"),
    flightNumber: colIndexByRole("flightNumber"),
    tailNumber: colIndexByRole("tailNumber"),
    aircraftModel: colIndexByRole("aircraftModel"),
    turnId: colIndexByRole("turnId"),
    turnDuration: colIndexByRole("turnDuration"),
    terminal: colIndexByRole("terminal"),
    domesticIntl: colIndexByRole("domesticIntl"),
  };

  // Get tooltip columns (up to 10)
  const tooltipIndices = columns
    .map((c, i) => ({ col: c, idx: i }))
    .filter(x => (x.col.roles as any)?.tooltips)
    .slice(0, 10);

  // helper seguro (si un campo no está en el visual, idx = -1)
  const get = (r: powerbi.DataViewTableRow, i: number) => (i >= 0 ? r[i] : null);

  const parsedRows: FlightRow[] = [];

  rows.forEach((r, rowIndex) => {
    const gate = String(get(r, idx.gate) ?? "").trim();
    if (!gate) return;

    const parentGate = get(r, idx.parentGate)?.toString() ?? null;

    // Build tooltip fields
    const tooltipFields = tooltipIndices.map(t => ({
      name: t.col.displayName,
      value: r[t.idx]
    }));

    // Create selection ID for cross-filtering
    const identity = host.createSelectionIdBuilder()
      .withTable(dataView.table!, rowIndex)
      .createSelectionId();

    const flightRow: FlightRow = {
      gate,
      parentGate,
      actualColor: get(r, idx.actualColor)?.toString() ?? null,

      groundStart: parseDate(get(r, idx.groundStart)),
      groundEnd: parseDate(get(r, idx.groundEnd)),
      landedTime: parseDate(get(r, idx.landedTime)),
      operationTime: parseDate(get(r, idx.operationTime)),

      scheduledStart: parseDate(get(r, idx.scheduledStart)),
      scheduledEnd: parseDate(get(r, idx.scheduledEnd)),

      actualStart: parseDate(get(r, idx.actualStart)),
      actualEnd: parseDate(get(r, idx.actualEnd)),

      towOff: parseDate(get(r, idx.towOff)),
      towOffStatus: get(r, idx.towOffStatus)?.toString() ?? null,

      towOn: parseDate(get(r, idx.towOn)),
      towOnStatus: get(r, idx.towOnStatus)?.toString() ?? null,

      actualText: get(r, idx.actualText)?.toString() ?? "",

      airline: get(r, idx.airline)?.toString() ?? null,
      flightNumber: get(r, idx.flightNumber)?.toString() ?? null,
      tailNumber: get(r, idx.tailNumber)?.toString() ?? null,
      aircraftModel: get(r, idx.aircraftModel)?.toString() ?? null,
      turnId: get(r, idx.turnId)?.toString() ?? null,
      turnDuration: get(r, idx.turnDuration)?.toString() ?? null,
      terminal: get(r, idx.terminal)?.toString() ?? null,
      domesticIntl: get(r, idx.domesticIntl)?.toString() ?? null,

      tooltipFields,
      identity
    };

    // ✅ REQUISITO 2a-ii: Si hay parent gate (wide-body), duplicar en gates hijos
    let childGates: string[] | null = null;

    if (parentGate) {
      // Primero verificar mappings manuales
      childGates = MANUAL_PARENT_TO_CHILDREN[parentGate] || getAdjacentGates(parentGate);
    } else if (gate.endsWith("W")) {
      // Si el gate mismo termina en "W", tratarlo como wide-body
      childGates = MANUAL_PARENT_TO_CHILDREN[gate] || getAdjacentGates(gate);
    }

    if (childGates && childGates.length > 0) {
      // Duplicar la fila para cada gate hijo
      childGates.forEach(childGate => {
        parsedRows.push({
          ...flightRow,
          gate: childGate,
          parentGate: parentGate || gate // Mantener referencia al parent original
        });
      });
    } else {
      // Fila normal (no wide-body)
      parsedRows.push(flightRow);
    }
  });

  if (!parsedRows.length) return null;

  // ✅ Show all gates including W gates and child gates for proper Y-axis spacing
  const gatesSet = new Set<string>();

  parsedRows.forEach(d => {
    gatesSet.add(d.gate); // Add the actual gate (child gate like A33, A35)
    if (d.parentGate) {
      gatesSet.add(d.parentGate); // Add the parent W gate (like A33W)
    }
  });

  const gates = Array.from(gatesSet).sort();

  const allDates: Date[] = [];
  parsedRows.forEach(d => {
    [
      d.groundStart,
      d.groundEnd,
      d.scheduledStart,
      d.scheduledEnd,
      d.actualStart,
      d.actualEnd,
      d.towOff,
      d.towOn,
    ].forEach(dt => {
      if (dt) allDates.push(dt);
    });
  });

  if (!allDates.length) return null;

  const timeDomain: [Date, Date] = [
    new Date(Math.min(...allDates.map(d => d.getTime()))),
    new Date(Math.max(...allDates.map(d => d.getTime()))),
  ];

  return { rows: parsedRows, gates, timeDomain };
}
