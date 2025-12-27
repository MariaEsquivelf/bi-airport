import * as d3 from "d3";
import { ParsedData } from "../model";

function isEstimated(v: any): boolean {
  if (v == null) return false;
  return String(v).toLowerCase().includes("estimated");
}

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9\-_]/g, "_");
}

/**
 * Construye puntos de un polígono para clipPath:
 * - rectángulo completo
 * - con borde dentado a la izquierda y/o derecha
 */
function buildClipPolygonPoints(
  x0: number,
  y0: number,
  w: number,
  h: number,
  amp: number,
  steps: number,
  jagLeft: boolean,
  jagRight: boolean
): string {
  const pts: [number, number][] = [];
  const dy = h / steps;

  // Empezamos arriba-izq
  if (jagLeft) {
    // borde superior, pero arrancando desde “dentro”
    pts.push([x0 + amp, y0]);
  } else {
    pts.push([x0, y0]);
  }

  // ---- TOP ----
  if (jagRight) {
    pts.push([x0 + w - amp, y0]);
  } else {
    pts.push([x0 + w, y0]);
  }

  // ---- RIGHT jagged DOWN ----
  if (jagRight) {
    for (let i = 0; i <= steps; i++) {
      const yy = y0 + i * dy;
      const xx = (i % 2 === 0) ? (x0 + w) : (x0 + w - amp);
      pts.push([xx, yy]);
    }
  } else {
    pts.push([x0 + w, y0 + h]);
  }

  // ---- BOTTOM ----
  if (jagLeft) {
    pts.push([x0 + amp, y0 + h]);
  } else {
    pts.push([x0, y0 + h]);
  }

  // ---- LEFT jagged UP ----
  if (jagLeft) {
    for (let i = steps; i >= 0; i--) {
      const yy = y0 + i * dy;
      const xx = (i % 2 === 0) ? (x0) : (x0 + amp);
      pts.push([xx, yy]);
    }
  } else {
    pts.push([x0, y0]);
  }

  return pts.map(p => p.join(",")).join(" ");
}

/**
 * Aplica dentado mediante clipPath sobre rect.actual-bar
 * (debe llamarse DESPUÉS de renderActualBars)
 */
export function renderTowEdges(
  barsG: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: ParsedData,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleBand<string>
) {
  // 1) Buscamos el <svg> para colocar defs
  const svgNode = (barsG.node() as any)?.ownerSVGElement as SVGSVGElement | null;
  if (!svgNode) return;

  const svg = d3.select(svgNode);

  // 2) Defs único
  let defs = svg.select<SVGDefsElement>("defs.tow-defs");
  if (defs.empty()) {
    defs = svg.append("defs").attr("class", "tow-defs");
  }

  // 3) Misma geometría que actual.ts (IMPORTANTE)
  const barH = Math.max(8, y.bandwidth() * 0.55);
  const yOffset = (y.bandwidth() - barH) / 2;

  const startTime = (d: any) => (d.actualStart ?? d.towOn) as Date | null;
  const endTime   = (d: any) => (d.actualEnd ?? d.towOff) as Date | null;

  // rows que tienen barra (por start/end)
  const rows = data.rows.filter(d => startTime(d) && endTime(d));

  const amp = Math.min(10, Math.max(6, barH * 0.35));
  const steps = 8;

  // 4) Creamos/actualizamos clipPaths SOLO para los que lo necesitan
  const needsClip = rows.filter(d =>
    (d.towOn && isEstimated(d.towOnStatus)) ||
    (d.towOff && isEstimated(d.towOffStatus))
  );

  const clipSel = defs
    .selectAll<SVGClipPathElement, any>("clipPath.tow-clip")
    .data(needsClip, (d: any) => {
      const s = startTime(d)!.toISOString();
      const e = endTime(d)!.toISOString();
      return `${d.gate}|${s}|${e}|clip`;
    });

  const clipEnter = clipSel.enter()
    .append("clipPath")
    .attr("class", "tow-clip")
    .attr("clipPathUnits", "userSpaceOnUse");

  // cada clipPath contiene 1 polygon
  clipEnter.append("polygon");

  const clipMerge = clipEnter.merge(clipSel as any);

  clipMerge
    .attr("id", (d: any) => {
      const s = safeId(startTime(d)!.toISOString());
      const e = safeId(endTime(d)!.toISOString());
      return `towclip_${safeId(d.gate)}_${s}_${e}`;
    })
    .each(function (d: any) {
      const s = startTime(d)!;
      const e = endTime(d)!;

      const x0 = x(s);
      const x1 = x(e);
      const w = Math.max(1, x1 - x0);
      const y0 = (y(d.gate) ?? 0) + yOffset;

      const jagLeft = !!(d.towOn && isEstimated(d.towOnStatus));
      const jagRight = !!(d.towOff && isEstimated(d.towOffStatus));

      const points = buildClipPolygonPoints(x0, y0, w, barH, amp, steps, jagLeft, jagRight);

      d3.select(this).select("polygon")
        .attr("points", points);
    });

  clipSel.exit().remove();

  // 5) Aplicar clip-path SOLO a los rect.actual-bar que lo necesitan.
  //    Y remover clip-path a los que ya no aplican.
  const rects = barsG.selectAll<SVGRectElement, any>("rect.actual-bar");

  rects.each(function (d: any) {
    const el = d3.select(this);

    const s = startTime(d);
    const e = endTime(d);
    if (!s || !e) {
      el.attr("clip-path", null);
      return;
    }

    const jagLeft = !!(d.towOn && isEstimated(d.towOnStatus));
    const jagRight = !!(d.towOff && isEstimated(d.towOffStatus));

    if (!jagLeft && !jagRight) {
      // no clip
      el.attr("clip-path", null);
      return;
    }

    const id = `towclip_${safeId(d.gate)}_${safeId(s.toISOString())}_${safeId(e.toISOString())}`;
    el.attr("clip-path", `url(#${id})`);
  });
}
