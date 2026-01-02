import * as d3 from "d3";
import { ParsedData } from "../model";

export function renderScheduledBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  // Filter: keep rows that have start AND end time, and overlap with viewport
  const rows = data.rows.filter(d => {
    if (!d.scheduledStart || !d.scheduledEnd) return false;

    // Show bar if it overlaps with the time domain (even partially)
    const [domainStart, domainEnd] = data.timeDomain;

    // Bar overlaps if: start < domainEnd AND end > domainStart
    return d.scheduledStart < domainEnd && d.scheduledEnd > domainStart;
  });

  // Group rows by parentGate to identify wide-body aircraft
  const wideBodyGroups = new Map<string, any[]>();
  const wideBodyKeys = new Set<string>();

  rows.forEach(row => {
    if (row.parentGate) {
      const key = `${row.parentGate}|${row.scheduledStart?.getTime()}`;

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
      const key = `${row.parentGate}|${row.scheduledStart?.getTime()}`;

      // Keep only if this is the first gate in the group
      const group = wideBodyGroups.get(key) || [];
      return group.length > 0 && row.gate === group[0].gate;
    }
    return true; // Keep non-wide-body rows
  });

  // Layout - más grande que actual para que se vea detrás
  const h = Math.max(8, y.bandwidth() * 0.40);
  const yOffset = (y.bandwidth() - h) / 2 + 8;  // +8 para bajar más

  const barsSel = g
    .selectAll<SVGRectElement, any>("rect.scheduled-bar")
    .data(rowsToRender, d => {
      const key = d.parentGate ? `${d.parentGate}|${d.scheduledStart}|${d.scheduledEnd}` : `${d.gate}|${d.scheduledStart}|${d.scheduledEnd}`;
      return key;
    });

  barsSel
    .enter()
    .append("rect")
    .attr("class", "scheduled-bar")
    .attr("rx", 16)
    .attr("ry", 16)
    .merge(barsSel as any)
    .attr("x", d => {
      const xPos = x(d.scheduledStart!);
      return Math.max(0, xPos);
    })
    .attr("y", d => {
      const yPos = y(d.gate) ?? 0;
      
      // For wide-body aircraft, span across multiple gates and position lower
      if (d.parentGate) {
        const key = `${d.parentGate}|${d.scheduledStart?.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];
        if (groupRows.length >= 2) {
          const gatePositions = groupRows
            .map((r: any) => y(r.gate))
            .filter((p: any) => p !== undefined) as number[];
          
          if (gatePositions.length >= 2) {
            // Add extra offset to position scheduled bar lower for wide-body
            return Math.min(...gatePositions) + yOffset + 18;
          }
        }
      }
      
      return yPos + yOffset;
    })
    .attr("width", d => {
      const xStart = x(d.scheduledStart!);
      const xEnd = x(d.scheduledEnd!);
      const xRange = x.range();
      const maxX = xRange[1];

      const clampedStart = Math.max(0, xStart);
      const clampedEnd = Math.min(maxX, xEnd);

      return Math.max(1, clampedEnd - clampedStart);
    })
    .attr("height", d => {
      // For wide-body aircraft, span the height of both gates
      if (d.parentGate) {
        const key = `${d.parentGate}|${d.scheduledStart?.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];
        if (groupRows.length >= 2) {
          const gatePositions = groupRows
            .map((r: any) => y(r.gate))
            .filter((p: any) => p !== undefined) as number[];
          
          if (gatePositions.length >= 2) {
            const minY = Math.min(...gatePositions);
            const maxY = Math.max(...gatePositions);
            const spanHeight = maxY - minY + y.bandwidth();
            return spanHeight - (yOffset * 2);
          }
        }
      }
      
      return h;
    });

  barsSel.exit().remove();

  // ✅ Agregar etiquetas de hora en las barras scheduled (inicio y fin)
  const labelsData: Array<{ gate: string; time: Date; side: 'start' | 'end'; x: number; y: number; textAnchor: string }> = [];

  rowsToRender.forEach(d => {
    const x1 = x(d.scheduledStart!);
    const x2 = x(d.scheduledEnd!);
    
    // For wide-body, calculate position INSIDE at the bottom of the expanded bar
    let yBase: number;
    if (d.parentGate) {
      const key = `${d.parentGate}|${d.scheduledStart?.getTime()}`;
      const groupRows = wideBodyGroups.get(key) || [];
      
      if (groupRows.length >= 2) {
        const gatePositions = groupRows
          .map((r: any) => y(r.gate))
          .filter((p: any) => p !== undefined) as number[];
        
        if (gatePositions.length >= 2) {
          // Position label INSIDE the bar at the bottom
          const minY = Math.min(...gatePositions);
          const maxY = Math.max(...gatePositions);
          const spanHeight = maxY - minY + y.bandwidth();
          const barBottomY = minY + spanHeight - yOffset + 18; // +18 matches the bar offset
          yBase = barBottomY - 8; // 8px from bottom inside the bar
        } else {
          yBase = (y(d.gate) ?? 0) + yOffset + h - 8;
        }
      } else {
        yBase = (y(d.gate) ?? 0) + yOffset + h - 8;
      }
    } else {
      yBase = (y(d.gate) ?? 0) + yOffset + h - 8; // Inside at bottom for normal bar
    }

    labelsData.push({
      gate: d.gate,
      time: d.scheduledStart!,
      side: 'start',
      x: x1 + 3,
      y: yBase,
      textAnchor: 'start'
    });

    labelsData.push({
      gate: d.gate,
      time: d.scheduledEnd!,
      side: 'end',
      x: x2 - 3,
      y: yBase,
      textAnchor: 'end'
    });
  });

  const labelsSel = g
    .selectAll<SVGTextElement, any>("text.scheduled-label")
    .data(labelsData, (d: any) => `${d.gate}|${d.time.getTime()}|${d.side}`);

  labelsSel
    .enter()
    .append("text")
    .attr("class", "scheduled-label")
    .merge(labelsSel as any)
    .attr("x", (d: any) => d.x)
    .attr("y", (d: any) => d.y)
    .attr("text-anchor", (d: any) => d.textAnchor)
    .text((d: any) => {
      const hour = d.time.getHours().toString().padStart(2, "0");
      const min = d.time.getMinutes().toString().padStart(2, "0");
      return `${hour}:${min}`;
    });

  labelsSel.exit().remove();
}
