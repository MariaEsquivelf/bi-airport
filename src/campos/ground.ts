import * as d3 from "d3";
import { ParsedData } from "../model";

// ✅ REQUISITO 4e: Stacked bars para landed time + operation time
export function renderGroundLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  const rows = data.rows.filter(d => d.groundStart && d.groundEnd);

  // Determinar si usar visualización básica o stacked bars
  const hasDetailedTimes = rows.some(d => d.landedTime || d.operationTime);

  if (hasDetailedTimes) {
    renderStackedGroundBars(g, rows, x, y);
  } else {
    renderSimpleGroundLines(g, rows, x, y);
  }
}

function renderSimpleGroundLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  rows: any[],
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  const sel = g.selectAll<SVGLineElement, any>("line.ground-line")
    .data(rows, (d: any) => `${d.gate}|${d.groundStart}|${d.groundEnd}`);

  sel.enter()
    .append("line")
    .attr("class", "ground-line")
    .merge(sel as any)
    .attr("x1", (d: any) => x(d.groundStart!))
    .attr("x2", (d: any) => x(d.groundEnd!))
    .attr("y1", (d: any) => (y(d.gate) ?? 0) + y.bandwidth() * 0.20)
    .attr("y2", (d: any) => (y(d.gate) ?? 0) + y.bandwidth() * 0.20);

  sel.exit().remove();
}

function renderStackedGroundBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  rows: any[],
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  // Limpiar líneas simples si existen
  g.selectAll("line.ground-line").remove();

  // Crear data para stacked segments
  const segments: Array<{
    gate: string;
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
        start: groundStart,
        end: landedTime,
        type: 'landed',
        key: `${d.gate}|${groundStart}|landed`
      });
      
      // Segmento 2: Operation time (desde landedTime hasta operationTime)
      segments.push({
        gate: d.gate,
        start: landedTime,
        end: operationTime,
        type: 'operation',
        key: `${d.gate}|${landedTime}|operation`
      });
    } else if (landedTime) {
      // Solo landed time disponible
      segments.push({
        gate: d.gate,
        start: groundStart,
        end: landedTime,
        type: 'landed',
        key: `${d.gate}|${groundStart}|landed`
      });
    } else {
      // Fallback a visualización simple
      segments.push({
        gate: d.gate,
        start: groundStart,
        end: groundEnd,
        type: 'operation',
        key: `${d.gate}|${groundStart}|operation`
      });
    }
  });

  const barHeight = 4; // Altura de cada segmento
  const yOffset = 0.15; // Posición relativa en el row

  const sel = g.selectAll<SVGRectElement, any>("rect.ground-segment")
    .data(segments, (d: any) => d.key);

  sel.enter()
    .append("rect")
    .attr("class", (d: any) => `ground-segment ground-${d.type}`)
    .merge(sel as any)
    .attr("x", (d: any) => x(d.start))
    .attr("width", (d: any) => Math.max(0, x(d.end) - x(d.start)))
    .attr("y", (d: any) => (y(d.gate) ?? 0) + y.bandwidth() * yOffset - barHeight / 2)
    .attr("height", barHeight)
    .attr("fill", (d: any) => d.type === 'landed' ? '#FF9800' : '#4CAF50')
    .attr("opacity", 0.7);

  sel.exit().remove();
}
