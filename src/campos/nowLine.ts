import * as d3 from "d3";

/**
 * Renderiza una línea vertical "NOW" que indica la hora actual
 * Útil para operaciones en tiempo real
 */
export function renderNowLine(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: d3.ScaleTime<number, number>,
  plotH: number,
  timeDomain: [Date, Date]
) {
  const now = new Date();
  
  // Solo mostrar si "now" está dentro del dominio visible
  if (now < timeDomain[0] || now > timeDomain[1]) {
    g.selectAll(".now-line").remove();
    g.selectAll(".now-label").remove();
    return;
  }

  const xPos = x(now);

  // Línea vertical
  const line = g.selectAll<SVGLineElement, unknown>("line.now-line")
    .data([null]);

  line.enter()
    .append("line")
    .attr("class", "now-line")
    .merge(line)
    .attr("x1", xPos)
    .attr("x2", xPos)
    .attr("y1", -30)
    .attr("y2", plotH)
    .attr("stroke", "#E74C3C")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("opacity", 0.8);

  // Label "NOW"
  const label = g.selectAll<SVGTextElement, unknown>("text.now-label")
    .data([null]);

  label.enter()
    .append("text")
    .attr("class", "now-label")
    .merge(label)
    .attr("x", xPos)
    .attr("y", -35)
    .attr("text-anchor", "middle")
    .attr("fill", "#E74C3C")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text("NOW");

  line.exit().remove();
  label.exit().remove();
}
