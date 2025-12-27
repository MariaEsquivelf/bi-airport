import powerbi from "powerbi-visuals-api";
import { FlightRow, ParsedData, parseDate } from "./model";

// ✅ Interfaz para filtros
export interface FilterCriteria {
  date: Date | null;
  timeMin: number;
  timeMax: number;
  terminal: string;
  gate: string;
  airline: string;
  flightNumber: string;
  tail: string;
}

export function applyFilters(rows: FlightRow[], filters: FilterCriteria): FlightRow[] {
  return rows.filter(row => {
    // Filter by date (si está setear, comparar solo la fecha)
    if (filters.date) {
      const rowDate = row.actualStart || row.towOn;
      if (rowDate) {
        const rowDateOnly = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());
        const filterDateOnly = new Date(filters.date.getFullYear(), filters.date.getMonth(), filters.date.getDate());
        if (rowDateOnly.getTime() !== filterDateOnly.getTime()) return false;
      }
    }

    // Filter by time window (hora del día)
    if (filters.timeMin >= 0 || filters.timeMax < 24) {
      const startTime = row.actualStart || row.towOn;
      if (startTime) {
        const hour = startTime.getHours();
        if (hour < filters.timeMin || hour > filters.timeMax) return false;
      }
    }

    // Filter by terminal
    if (filters.terminal && row.terminal && !row.terminal.toLowerCase().includes(filters.terminal.toLowerCase())) {
      return false;
    }

    // Filter by gate
    if (filters.gate && !row.gate.toLowerCase().includes(filters.gate.toLowerCase())) {
      return false;
    }

    // Filter by airline
    if (filters.airline && row.airline && !row.airline.toLowerCase().includes(filters.airline.toLowerCase())) {
      return false;
    }

    // Filter by flight number
    if (filters.flightNumber && row.flightNumber && !row.flightNumber.toLowerCase().includes(filters.flightNumber.toLowerCase())) {
      return false;
    }

    // Filter by tail
    if (filters.tail && row.tailNumber && !row.tailNumber.toLowerCase().includes(filters.tail.toLowerCase())) {
      return false;
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
  // Ejemplo: A17W (wide-body) ocupa A17 y A15
  const PARENT_TO_CHILDREN: Record<string, string[]> = {
    "A17W": ["A17", "A15"],
    "A33W": ["A33", "A31"],
    // Agregar más mappings según configuración del aeropuerto
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
    if (parentGate && PARENT_TO_CHILDREN[parentGate]) {
      const childGates = PARENT_TO_CHILDREN[parentGate];
      childGates.forEach(childGate => {
        parsedRows.push({
          ...flightRow,
          gate: childGate,
          parentGate: parentGate // Mantener referencia al parent
        });
      });
    } else {
      // Fila normal (no wide-body)
      parsedRows.push(flightRow);
    }
  });

  if (!parsedRows.length) return null;

  const gates = Array.from(new Set(parsedRows.map(d => d.gate))).sort();

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
