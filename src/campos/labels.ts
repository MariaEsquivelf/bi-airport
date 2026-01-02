import * as d3 from "d3";
import { ParsedData } from "../model";

export function renderActualLabels(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  // Group wide-body aircraft to calculate correct position
  const wideBodyGroups = new Map<string, any[]>();
  const wideBodyKeys = new Set<string>();
  
  data.rows.forEach(row => {
    if (row.parentGate) {
      const startTime = row.actualStart || row.towOn;
      const key = `${row.parentGate}|${startTime?.getTime()}`;
      
      if (!wideBodyGroups.has(key)) {
        wideBodyGroups.set(key, []);
      }
      wideBodyGroups.get(key)!.push(row);
      wideBodyKeys.add(key);
    }
  });
  
  // Filter out wide-body duplicates - keep only first occurrence
  const rows = data.rows.filter(d => {
    if (!(d.actualStart || d.towOn) || !(d.actualEnd || d.towOff)) return false;
    
    // Filter wide-body duplicates
    if (d.parentGate) {
      const startTime = d.actualStart || d.towOn;
      const key = `${d.parentGate}|${startTime?.getTime()}`;
      const group = wideBodyGroups.get(key) || [];
      return group.length > 0 && d.gate === group[0].gate;
    }
    return true;
  });

  const h = Math.max(8, y.bandwidth() * 0.38);
  const yOffset = (y.bandwidth() - h) / 2;

  const startTime = (d: any): Date => (d.actualStart ?? d.towOn) as Date;
  const endTime = (d: any): Date => (d.actualEnd ?? d.towOff) as Date;

  // ✅ Etiquetas: texto central + horas de inicio/fin
  const textLabelsData: Array<{ gate: string; content: string; x: number; y: number }> = [];
  const timeLabelsData: Array<{ gate: string; time: Date; side: 'start' | 'end'; x: number; y: number; textAnchor: string }> = [];

  rows.forEach(d => {
    const barX = x(startTime(d));
    const barWidth = x(endTime(d)) - barX;
    const x1 = x(startTime(d));
    const x2 = x(endTime(d));
    
    // For wide-body, calculate position INSIDE the center of the expanded bar
    let yBase: number;
    if (d.parentGate) {
      const key = `${d.parentGate}|${startTime(d).getTime()}`;
      const groupRows = wideBodyGroups.get(key) || [];
      
      if (groupRows.length >= 2) {
        const gatePositions = groupRows
          .map((r: any) => y(r.gate))
          .filter((p: any) => p !== undefined) as number[];
        
        if (gatePositions.length >= 2) {
          // Position label in the CENTER of the expanded bar
          const minY = Math.min(...gatePositions);
          const maxY = Math.max(...gatePositions);
          const spanHeight = maxY - minY + y.bandwidth();
          yBase = minY + spanHeight / 2; // Center of expanded bar
        } else {
          yBase = (y(d.gate) ?? 0) + y.bandwidth() / 2;
        }
      } else {
        yBase = (y(d.gate) ?? 0) + y.bandwidth() / 2;
      }
    } else {
      yBase = (y(d.gate) ?? 0) + y.bandwidth() / 2; // Center of normal bar
    }
    
    // Label texto (centro) - siempre mostrar
    if (d.actualText) {
      textLabelsData.push({
        gate: d.gate,
        content: d.actualText,
        x: barX + barWidth / 2,
        y: yBase
      });
    }
    
    // Time labels (start and end)
    timeLabelsData.push({
      gate: d.gate,
      time: startTime(d),
      side: 'start',
      x: x1 + 3,
      y: yBase,
      textAnchor: 'start'
    });
    
    timeLabelsData.push({
      gate: d.gate,
      time: endTime(d),
      side: 'end',
      x: x2 - 3,
      y: yBase,
      textAnchor: 'end'
    });
  });

  // Render text labels (flight info)
  const textSel = g.selectAll<SVGTextElement, any>("text.actual-label")
    .data(textLabelsData, (d: any) => `${d.gate}|${d.content}`);

  textSel.enter()
    .append("text")
    .attr("class", "actual-label")
    .merge(textSel as any)
    .attr("x", (d: any) => d.x)
    .attr("y", (d: any) => d.y)
    .attr("text-anchor", "middle")
    .text((d: any) => d.content);

  textSel.exit().remove();
  
  // Render time labels (start/end times)
  const timeSel = g.selectAll<SVGTextElement, any>("text.actual-time-label")
    .data(timeLabelsData, (d: any) => `${d.gate}|${d.time.getTime()}|${d.side}`);

  timeSel.enter()
    .append("text")
    .attr("class", "actual-time-label")
    .merge(timeSel as any)
    .attr("x", (d: any) => d.x)
    .attr("y", (d: any) => d.y)
    .attr("text-anchor", (d: any) => d.textAnchor)
    .text((d: any) => {
      const hour = d.time.getHours().toString().padStart(2, "0");
      const min = d.time.getMinutes().toString().padStart(2, "0");
      return `${hour}:${min}`;
    });

  timeSel.exit().remove();
}
