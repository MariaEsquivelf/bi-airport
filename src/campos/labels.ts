import * as d3 from "d3";
import { ParsedData } from "../model";

export function renderActualLabels(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  const fmt = d3.timeFormat("%H:%M");
  const rows = data.rows.filter(d => (d.actualStart || d.towOn) && (d.actualEnd || d.towOff));

  const h = Math.max(8, y.bandwidth() * 0.55);
  const yOffset = (y.bandwidth() - h) / 2;

  const startTime = (d: any): Date => (d.actualStart ?? d.towOn) as Date;
  const endTime = (d: any): Date => (d.actualEnd ?? d.towOff) as Date;

  // ✅ Crear datos para 3 labels: inicio (izq), texto (centro), fin (der)
  const labelsData: Array<{ gate: string; type: 'start' | 'text' | 'end'; content: string; x: number; y: number; textAnchor: string }> = [];

  rows.forEach(d => {
    const barX = x(startTime(d));
    const barWidth = x(endTime(d)) - barX;
    const yBase = (y(d.gate) ?? 0) + yOffset + h / 2;
    
    // Label inicio (izquierda)
    labelsData.push({
      gate: d.gate,
      type: 'start',
      content: fmt(startTime(d)),
      x: barX + 3,
      y: yBase,
      textAnchor: 'start'
    });
    
    // Label texto (centro) - solo si hay espacio
    if (barWidth > 60) {
      labelsData.push({
        gate: d.gate,
        type: 'text',
        content: d.actualText ?? "",
        x: barX + barWidth / 2,
        y: yBase,
        textAnchor: 'middle'
      });
    }
    
    // Label fin (derecha) - solo si hay espacio
    if (barWidth > 80) {
      labelsData.push({
        gate: d.gate,
        type: 'end',
        content: fmt(endTime(d)),
        x: barX + barWidth - 3,
        y: yBase,
        textAnchor: 'end'
      });
    }
  });

  const sel = g.selectAll<SVGTextElement, any>("text.actual-label")
    .data(labelsData, (d: any) => `${d.gate}|${d.type}|${d.content}`);

  sel.enter()
    .append("text")
    .attr("class", "actual-label")
    .merge(sel as any)
    .attr("x", (d: any) => d.x)
    .attr("y", (d: any) => d.y)
    .attr("text-anchor", (d: any) => d.textAnchor)
    .text((d: any) => d.content);

  sel.exit().remove();
}
