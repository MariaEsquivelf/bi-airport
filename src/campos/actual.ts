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

  const rows = data.rows.filter(d => {
    if (!(d.actualStart || d.towOn) && !(d.actualEnd || d.towOff)) return false;

    const start = d.actualStart || d.towOn;
    const end = d.actualEnd || d.towOff;

    // Show bar if it overlaps with the time domain (even partially)
    const [domainStart, domainEnd] = data.timeDomain;

    // Bar overlaps if: start < domainEnd AND end > domainStart
    if (start && end) {
      return start < domainEnd && end > domainStart;
    }
    // If only start exists, show if it's within domain
    if (start) {
      return start < domainEnd;
    }
    // If only end exists, show if it's within domain
    if (end) {
      return end > domainStart;
    }

    return false;
  });

  // Group rows by parentGate to identify wide-body aircraft
  const wideBodyGroups = new Map<string, FlightRow[]>();
  const wideBodyKeys = new Set<string>();

  rows.forEach(row => {
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

  // Filter out duplicate wide-body rows - keep only the FIRST occurrence
  const rowsToRender = rows.filter(row => {
    if (row.parentGate) {
      const startTime = row.actualStart || row.towOn;
      const key = `${row.parentGate}|${startTime?.getTime()}`;

      // Keep only if this is the first gate in the group
      const group = wideBodyGroups.get(key) || [];
      return group.length > 0 && row.gate === group[0].gate;
    }
    return true; // Keep non-wide-body rows
  });

  const barH = Math.max(8, y.bandwidth() * 0.38);
  const yOffset = (y.bandwidth() - barH) / 2;

  const startTime = (d: FlightRow): Date => (d.actualStart ?? d.towOn) as Date;
  const endTime = (d: FlightRow): Date => (d.actualEnd ?? d.towOff) as Date;

  const sel = g
    .selectAll<SVGRectElement, FlightRow>("rect.actual-bar")
    .data(
      rowsToRender,
      (d: FlightRow) => {
        const s = startTime(d).toISOString();
        const e = endTime(d).toISOString();
        const key = d.parentGate ? `${d.parentGate}|${s}|${e}` : `${d.gate}|${s}|${e}`;
        return key;
      }
    );

  const bars = sel.enter()
    .append("rect")
    .attr("class", "actual-bar")
    .attr("rx", 16)
    .attr("ry", 16)
    .merge(sel as any)
    .attr("x", (d: FlightRow) => {
      const xPos = x(startTime(d));
      return Math.max(0, xPos);
    })
    .attr("y", (d: FlightRow) => {
      const yPos = y(d.gate) ?? 0;


      // For wide-body aircraft, span across multiple gates
      if (d.parentGate) {
        const st = startTime(d);
        const key = `${d.parentGate}|${st.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];

        if (groupRows.length >= 2) {
          // Get all gate positions for this wide-body
          const gatePositions = groupRows
            .map(r => y(r.gate))
            .filter(p => p !== undefined) as number[];

          if (gatePositions.length >= 2) {
            // Start from the topmost gate
            return Math.min(...gatePositions) + yOffset;
          }
        }
      }

      return yPos + yOffset;
    })
    .attr("width", (d: FlightRow) => {
      const xStart = x(startTime(d));
      const xEnd = x(endTime(d));
      const xRange = x.range();
      const maxX = xRange[1];

      const clampedStart = Math.max(0, xStart);
      const clampedEnd = Math.min(maxX, xEnd);

      return Math.max(1, clampedEnd - clampedStart);
    })
    .attr("height", (d: FlightRow) => {
      // For wide-body aircraft, span the height of both gates
      if (d.parentGate) {
        const st = startTime(d);
        const key = `${d.parentGate}|${st.getTime()}`;
        const groupRows = wideBodyGroups.get(key) || [];

        if (groupRows.length >= 2) {
          const gatePositions = groupRows
            .map(r => y(r.gate))
            .filter(p => p !== undefined) as number[];

          if (gatePositions.length >= 2) {
            // Calculate height spanning from min to max gate position
            const minY = Math.min(...gatePositions);
            const maxY = Math.max(...gatePositions);
            const spanHeight = maxY - minY + y.bandwidth();
            return spanHeight - (yOffset * 2);
          }
        }
      }

      return barH;
    })
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
