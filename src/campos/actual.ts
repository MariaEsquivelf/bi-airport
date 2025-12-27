import * as d3 from "d3";
import { ParsedData, FlightRow } from "../model";
import { getColorKey } from "./color";
import powerbi from "powerbi-visuals-api";

export function renderActualBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>,
  color: d3.ScaleOrdinal<string, string>,
  selectionManager: powerbi.extensibility.ISelectionManager,
  host: powerbi.extensibility.visual.IVisualHost,
  colorDimension: string = "actualColor"
) {
  // ✅ barras “actual” usando fallback Tow_On / Tow_Off
  const rows = data.rows.filter(d => (d.actualStart || d.towOn) && (d.actualEnd || d.towOff));

  const barH = Math.max(8, y.bandwidth() * 0.55);
  const yOffset = (y.bandwidth() - barH) / 2;

  const startTime = (d: FlightRow): Date => (d.actualStart ?? d.towOn) as Date;
  const endTime = (d: FlightRow): Date => (d.actualEnd ?? d.towOff) as Date;

  const sel = g
    .selectAll<SVGRectElement, FlightRow>("rect.actual-bar")
    .data(
      rows,
      (d: FlightRow) => {
        const s = startTime(d).toISOString();
        const e = endTime(d).toISOString();
        return `${d.gate}|${s}|${e}`; // ✅ key estable
      }
    );

  const bars = sel.enter()
    .append("rect")
    .attr("class", "actual-bar")
    .attr("rx", 16)
    .attr("ry", 16)
    .merge(sel as any)
    .attr("x", (d: FlightRow) => x(startTime(d)))
    .attr("y", (d: FlightRow) => (y(d.gate) ?? 0) + yOffset)
    .attr("width", (d: FlightRow) => Math.max(1, x(endTime(d)) - x(startTime(d))))
    .attr("height", barH)
    .attr("fill", (d: FlightRow) => color(getColorKey(d, colorDimension)))
    .style("cursor", "pointer")
    .style("opacity", 1);

  // Add selection behavior
  bars.on("click", function(event: MouseEvent, d: FlightRow) {
    event.stopPropagation();
    if (d.identity) {
      selectionManager.select(d.identity, event.ctrlKey || event.metaKey)
        .then((ids: powerbi.visuals.ISelectionId[]) => {
          bars.style("opacity", ids.length > 0 ? 0.3 : 1);
          d3.select(this).style("opacity", 1);
        });
    }
  });

  // Add tooltip
  bars.on("mouseover", function(event: MouseEvent, d: FlightRow) {
    const tooltipData: powerbi.extensibility.VisualTooltipDataItem[] = [
      { displayName: "Gate", value: d.gate },
      { displayName: "Start Time", value: startTime(d).toLocaleString() },
      { displayName: "End Time", value: endTime(d).toLocaleString() },
    ];

    if (d.airline) tooltipData.push({ displayName: "Airline", value: d.airline });
    if (d.flightNumber) tooltipData.push({ displayName: "Flight Number", value: d.flightNumber });
    if (d.tailNumber) tooltipData.push({ displayName: "Tail Number", value: d.tailNumber });
    if (d.aircraftModel) tooltipData.push({ displayName: "Aircraft Model", value: d.aircraftModel });
    if (d.turnId) tooltipData.push({ displayName: "Turn ID", value: d.turnId });
    if (d.turnDuration) tooltipData.push({ displayName: "Turn Duration", value: d.turnDuration });

    d.tooltipFields.forEach(field => {
      if (field.value) {
        tooltipData.push({ displayName: field.name, value: String(field.value) });
      }
    });

    host.tooltipService.show({
      dataItems: tooltipData,
      identities: d.identity ? [d.identity] : [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false
    });
  });

  bars.on("mousemove", function(event: MouseEvent, d: FlightRow) {
    host.tooltipService.move({
      identities: d.identity ? [d.identity] : [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false
    });
  });

  bars.on("mouseout", function() {
    host.tooltipService.hide({
      immediately: true,
      isTouchEvent: false
    });
  });

  sel.exit().remove();
}
