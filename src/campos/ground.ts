import * as d3 from "d3";
import { ParsedData } from "../model";

// ✅ REQUISITO 4e: Stacked bars para landed time + operation time
export function renderGroundLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  // Filter: keep rows that have start AND end time, and overlap with viewport
  const rows = data.rows.filter(d => {
    if (!d.groundStart || !d.groundEnd) return false;
    
    // Show bar if it overlaps with the time domain (even partially)
    const [domainStart, domainEnd] = data.timeDomain;
    
    // Bar overlaps if: start < domainEnd AND end > domainStart
    return d.groundStart < domainEnd && d.groundEnd > domainStart;
  });

  // Group rows by parentGate to identify wide-body aircraft
  const wideBodyGroups = new Map<string, any[]>();
  const wideBodyKeys = new Set<string>();
  
  rows.forEach(row => {
    if (row.parentGate) {
      const key = `${row.parentGate}|${row.groundStart?.getTime()}`;
      
      if (!wideBodyGroups.has(key)) {
        wideBodyGroups.set(key, []);
      }
      wideBodyGroups.get(key)!.push(row);
      wideBodyKeys.add(key);
    }
  });

  // Filter out duplicate wide-body rows - keep only the FIRST occurrence
  const rowsToRender = rows.filter(row => {
    if (row.parentGate) {
      const key = `${row.parentGate}|${row.groundStart?.getTime()}`;
      
      // Keep only if this is the first gate in the group
      const group = wideBodyGroups.get(key) || [];
      return group.length > 0 && row.gate === group[0].gate;
    }
    return true; // Keep non-wide-body rows
  });

  // Determinar si usar visualización básica o stacked bars
  const hasDetailedTimes = rowsToRender.some(d => d.landedTime || d.operationTime);

  if (hasDetailedTimes) {
    renderStackedGroundBars(g, rowsToRender, x, y, wideBodyGroups);
  } else {
    renderSimpleGroundLines(g, rowsToRender, x, y, wideBodyGroups);
  }
}

function renderSimpleGroundLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  rows: any[],
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>,
  wideBodyGroups: Map<string, any[]>
) {
  const sel = g.selectAll<SVGLineElement, any>("line.ground-line")
    .data(rows, (d: any) => `${d.gate}|${d.groundStart}|${d.groundEnd}`);

  sel.enter()
    .append("line")
    .attr("class", "ground-line")
    .merge(sel as any)
    .attr("x1", (d: any) => {
      const xPos = x(d.groundStart!);
      const xRange = x.range();
      return Math.max(xRange[0], Math.min(xRange[1], xPos));
    })
    .attr("x2", (d: any) => {
      const xPos = x(d.groundEnd!);
      const xRange = x.range();
      return Math.max(xRange[0], Math.min(xRange[1], xPos));
    })
    .attr("y1", (d: any) => {
      const yPos = y(d.gate) ?? 0;
      
      // For wide-body aircraft, position at the TOP of the topmost gate
      if (d.parentGate) {
        const key = `${d.parentGate}|${d.groundStart?.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];
        if (groupRows.length >= 2) {
          const gatePositions = groupRows
            .map((r: any) => y(r.gate))
            .filter((p: any) => p !== undefined) as number[];
          
          if (gatePositions.length >= 2) {
            const minY = Math.min(...gatePositions);
            return minY + y.bandwidth() * 0.15; // Top of the wide-body span
          }
        }
      }
      
      return yPos + y.bandwidth() * 0.10;
    })
    .attr("y2", (d: any) => {
      const yPos = y(d.gate) ?? 0;
      
      // For wide-body aircraft, position at the TOP of the topmost gate
      if (d.parentGate) {
        const key = `${d.parentGate}|${d.groundStart?.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];
        if (groupRows.length >= 2) {
          const gatePositions = groupRows
            .map((r: any) => y(r.gate))
            .filter((p: any) => p !== undefined) as number[];
          
          if (gatePositions.length >= 2) {
            const minY = Math.min(...gatePositions);
            return minY + y.bandwidth() * 0.15; // Top of the wide-body span
          }
        }
      }
      
      return yPos + y.bandwidth() * 0.10;
    });

  sel.exit().remove();
}

function renderStackedGroundBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  rows: any[],
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>,
  wideBodyGroups: Map<string, any[]>
) {
  // Limpiar líneas simples si existen
  g.selectAll("line.ground-line").remove();

  // Crear data para stacked segments
  const segments: Array<{
    gate: string;
    parentGate?: string | null;
    start: Date;
    end: Date;
    type: 'landed' | 'operation';
    key: string;
  }> = [];

  rows.forEach(d => {
    const groundStart = d.groundStart!;
    const groundEnd = d.groundEnd!;
    const landedTime = d.landedTime;
    const operationTime = d.operationTime;

    if (landedTime && operationTime) {
      // Segmento 1: Landed time (desde groundStart hasta landedTime)
      segments.push({
        gate: d.gate,
        parentGate: d.parentGate,
        start: groundStart,
        end: landedTime,
        type: 'landed',
        key: `${d.gate}|${groundStart}|landed`
      });
      
      // Segmento 2: Operation time (desde landedTime hasta operationTime)
      segments.push({
        gate: d.gate,
        parentGate: d.parentGate,
        start: landedTime,
        end: operationTime,
        type: 'operation',
        key: `${d.gate}|${landedTime}|operation`
      });
    } else if (landedTime) {
      // Solo landed time disponible
      segments.push({
        gate: d.gate,
        parentGate: d.parentGate,
        start: groundStart,
        end: landedTime,
        type: 'landed',
        key: `${d.gate}|${groundStart}|landed`
      });
    } else {
      // Fallback a visualización simple
      segments.push({
        gate: d.gate,
        parentGate: d.parentGate,
        start: groundStart,
        end: groundEnd,
        type: 'operation',
        key: `${d.gate}|${groundStart}|operation`
      });
    }
  });

  const barHeight = 4; // Altura de cada segmento
  const yOffset = 0.10; // Posición relativa en el row (arriba)

  const sel = g.selectAll<SVGRectElement, any>("rect.ground-segment")
    .data(segments, (d: any) => d.key);

  sel.enter()
    .append("rect")
    .attr("class", (d: any) => `ground-segment ground-${d.type}`)
    .merge(sel as any)
    .attr("x", (d: any) => {
      const xPos = x(d.start);
      return Math.max(0, xPos);
    })
    .attr("width", (d: any) => {
      const xStart = x(d.start);
      const xEnd = x(d.end);
      const xRange = x.range();
      const maxX = xRange[1];
      
      const clampedStart = Math.max(0, xStart);
      const clampedEnd = Math.min(maxX, xEnd);
      
      return Math.max(0, clampedEnd - clampedStart);
    })
    .attr("y", (d: any) => {
      const yPos = y(d.gate) ?? 0;
      
      // For wide-body aircraft, position at the TOP of the topmost gate
      if (d.parentGate) {
        const key = `${d.parentGate}|${d.start?.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];
        if (groupRows.length >= 2) {
          const gatePositions = groupRows
            .map((r: any) => y(r.gate))
            .filter((p: any) => p !== undefined) as number[];
          
          if (gatePositions.length >= 2) {
            const minY = Math.min(...gatePositions);
            return minY + y.bandwidth() * 0.15 - barHeight / 2; // Top of the wide-body span
          }
        }
      }
      
      return yPos + y.bandwidth() * yOffset - barHeight / 2;
    })
    .attr("height", barHeight)
    .attr("fill", (d: any) => d.type === 'landed' ? '#FF9800' : '#4CAF50')
    .attr("opacity", 0.7);

  sel.exit().remove();
}
