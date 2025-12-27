import * as d3 from "d3";
import { ParsedData } from "../model";

export function renderScheduledBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  const rows = data.rows.filter(d => d.scheduledStart && d.scheduledEnd);

  // Layout - más grande que actual para que se vea detrás
  const h = Math.max(10, y.bandwidth() * 0.65);
  const yOffset = (y.bandwidth() - h) / 2 + 8;  // +8 para bajar más

  const barsSel = g
    .selectAll<SVGRectElement, any>("rect.scheduled-bar")
    .data(rows, d => `${d.gate}|${d.scheduledStart}|${d.scheduledEnd}`);

  barsSel
    .enter()
    .append("rect")
    .attr("class", "scheduled-bar")
    .attr("rx", 16)
    .attr("ry", 16)
    .merge(barsSel as any)
    .attr("x", d => x(d.scheduledStart!))
    .attr("y", d => (y(d.gate) ?? 0) + yOffset)
    .attr("width", d => Math.max(1, x(d.scheduledEnd!) - x(d.scheduledStart!)))
    .attr("height", h);

  barsSel.exit().remove();

  // ✅ Agregar etiquetas de hora en las barras scheduled (inicio y fin)
  const labelsData: Array<{ gate: string; time: Date; side: 'start' | 'end'; x: number; y: number; textAnchor: string }> = [];
  
  rows.forEach(d => {
    const x1 = x(d.scheduledStart!);
    const x2 = x(d.scheduledEnd!);
    const yBase = (y(d.gate) ?? 0) + yOffset + h - 3; // DENTRO de la barra, en la parte baja
    
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
