"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import * as d3 from "d3";

import { parseDataView, applyFilters, FilterCriteria } from "./parse";
import { ParsedData } from "./model";

// (por ahora no los usamos)
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";

// ✅ imports de los módulos
import { buildColorScale, getColorKey } from "./campos/color";
import { renderGroundLines } from "./campos/ground";
import { renderScheduledBars } from "./campos/scheduled";
import { renderActualBars } from "./campos/actual";
import { renderActualLabels } from "./campos/labels";
import { renderTowEdges } from "./campos/tow";
import { renderNowLine } from "./campos/nowLine";

// Tipos Power BI
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

export class Visual implements IVisual {
  // ===== DOM =====
  private target: HTMLElement;
  private root!: HTMLDivElement;
  private scroll!: HTMLDivElement;
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gRoot!: d3.Selection<SVGGElement, unknown, null, undefined>;

  // ===== Power BI services =====
  private host: powerbi.extensibility.visual.IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private formattingSettings: VisualFormattingSettingsModel;
  private formattingSettingsService: FormattingSettingsService;

  // ===== Layout =====
  private margin = { top: 40, right: 20, bottom: 20, left: 90 };
  private rowHeight = 44;
  private pxPerHour = 120;

  // ===== Data =====
  private data: ParsedData | null = null;

  // ===== Filters =====
  private filters = {
    date: null as Date | null,
    timeMin: 0,
    timeMax: 24,
    terminal: "",
    gate: "",
    airline: "",
    flightNumber: "",
    tail: ""
  };

  // ===== Layers =====
  private xAxisG!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private yAxisG!: d3.Selection<SVGGElement, unknown, null, undefined>;

  private groundG!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private scheduledG!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private barsG!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private labelsG!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private nowLineG!: d3.Selection<SVGGElement, unknown, null, undefined>;

  constructor(options: VisualConstructorOptions) {
    this.target = options.element;
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.formattingSettingsService = new FormattingSettingsService();

    // Root
    this.root = document.createElement("div");
    this.root.style.width = "100%";
    this.root.style.height = "100%";
    this.root.style.position = "relative";
    this.root.style.display = "flex";
    this.root.style.flexDirection = "column";
    this.target.appendChild(this.root);

    // ✅ Filter bar (header)
    const filterBar = document.createElement("div");
    filterBar.id = "filter-bar";
    filterBar.style.display = "flex";
    filterBar.style.gap = "12px";
    filterBar.style.padding = "12px";
    filterBar.style.backgroundColor = "#f5f5f5";
    filterBar.style.borderBottom = "1px solid #ddd";
    filterBar.style.flexWrap = "wrap";
    filterBar.style.alignItems = "center";
    this.root.appendChild(filterBar);

    // Create filter controls
    const createFilterControl = (label: string, id: string, type: 'date' | 'text' | 'select' = 'text') => {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.gap = "4px";

      const labelEl = document.createElement("label");
      labelEl.textContent = label;
      labelEl.style.fontSize = "11px";
      labelEl.style.fontWeight = "600";
      labelEl.style.color = "#333";

      let input: HTMLElement;
      if (type === 'date') {
        input = document.createElement("input");
        (input as HTMLInputElement).type = "date";
      } else if (type === 'select') {
        input = document.createElement("select");
      } else {
        input = document.createElement("input");
        (input as HTMLInputElement).type = "text";
        (input as HTMLInputElement).placeholder = id === "filter-time" ? "e.g. 8-16 (start-end)" : label;
      }

      (input as any).id = id;
      (input as any).style.padding = "6px 8px";
      (input as any).style.fontSize = "11px";
      (input as any).style.border = "1px solid #ccc";
      (input as any).style.borderRadius = "3px";
      (input as any).style.minWidth = "100px";

      wrapper.appendChild(labelEl);
      wrapper.appendChild(input);
      filterBar.appendChild(wrapper);
      return input;
    };

    // Add filter controls
    createFilterControl("Date", "filter-date", "date");
    createFilterControl("Time View (hr)", "filter-time", "text");
    createFilterControl("Terminal", "filter-terminal", "text");
    createFilterControl("Gate", "filter-gate", "text");
    createFilterControl("Airline", "filter-airline", "text");
    createFilterControl("Flight #", "filter-flight", "text");
    createFilterControl("Tail", "filter-tail", "text");

    // ✅ Add event listeners to filters
    const updateFilterHandler = () => this.applyFiltersAndUpdate();

    document.getElementById("filter-date")?.addEventListener("change", updateFilterHandler);
    document.getElementById("filter-time")?.addEventListener("change", updateFilterHandler);
    document.getElementById("filter-terminal")?.addEventListener("input", updateFilterHandler);
    document.getElementById("filter-gate")?.addEventListener("input", updateFilterHandler);
    document.getElementById("filter-airline")?.addEventListener("input", updateFilterHandler);
    document.getElementById("filter-flight")?.addEventListener("input", updateFilterHandler);
    document.getElementById("filter-tail")?.addEventListener("input", updateFilterHandler);

    // Scroll container
    this.scroll = document.createElement("div");
    this.scroll.style.width = "100%";
    this.scroll.style.height = "100%";
    this.scroll.style.flex = "1";
    this.scroll.style.overflow = "auto";
    this.root.appendChild(this.scroll);

    // SVG
    this.svg = d3.select(this.scroll).append("svg");

    // Root group
    this.gRoot = this.svg.append("g").attr("class", "gantt-root");

    // Allow selection to be cleared by clicking on background
    this.svg.on("click", (event) => {
      if (event.target === (this.svg.node() as any)) {
        this.selectionManager.clear();
      }
    });
  }

  public update(options: VisualUpdateOptions): void {
    const dataView = options.dataViews?.[0];
    if (!dataView) return;

    this.data = parseDataView(dataView, this.host);
    if (!this.data) return;

    // Get formatting settings
    this.formattingSettings =
      this.formattingSettingsService.populateFormattingSettingsModel(
        VisualFormattingSettingsModel,
        dataView
      );

    // Apply settings
    this.rowHeight = this.formattingSettings.displayCard.rowHeight.value;
    this.pxPerHour = this.formattingSettings.displayCard.pxPerHour.value;
    const colorDimension = (
      this.formattingSettings.displayCard.colorDimension.value as any
    ).value as string;

    const viewportW = options.viewport.width;
    const viewportH = options.viewport.height;

    // =========================================================
    // ✅ REQUISITO 3a & 3b: Dominio de tiempo dinámico
    // - Máximo 24 horas
    // - Auto-zoom si los datos tienen menos de 24h
    // =========================================================
    const coreDates: Date[] = [];
    this.data.rows.forEach((d) => {
      [
        d.groundStart,
        d.groundEnd,
        d.scheduledStart,
        d.scheduledEnd,
        d.actualStart,
        d.actualEnd,
      ].forEach((dt) => {
        if (dt) coreDates.push(dt);
      });
    });

    if (!coreDates.length) return;

    const dataMin = new Date(Math.min(...coreDates.map((d) => d.getTime())));
    const dataMax = new Date(Math.max(...coreDates.map((d) => d.getTime())));

    // Calcular span de datos en horas
    const dataSpanHours =
      (dataMax.getTime() - dataMin.getTime()) / (60 * 60 * 1000);

    let t0: Date, t1: Date, hours: number;

    if (dataSpanHours < 24) {
      // REQUISITO 3b: Auto-zoom cuando hay menos de 24h de datos
      // Agregar 1h de padding a cada lado
      t0 = new Date(dataMin.getTime() - 1 * 60 * 60 * 1000);
      t1 = new Date(dataMax.getTime() + 1 * 60 * 60 * 1000);
      hours = Math.ceil((t1.getTime() - t0.getTime()) / (60 * 60 * 1000));
    } else {
      // REQUISITO 3a: Ventana fija de 24h desde el mínimo
      t0 = new Date(dataMin.getTime());
      t1 = new Date(t0.getTime() + 24 * 60 * 60 * 1000);
      hours = 24;
    }

    // ---- Virtual canvas size (scroll) ----
    const innerW = Math.max(
      viewportW,
      this.margin.left + this.margin.right + hours * this.pxPerHour
    );

    const innerH = Math.max(
      viewportH,
      this.margin.top +
        this.margin.bottom +
        this.data.gates.length * this.rowHeight
    );

    this.svg.attr("width", innerW).attr("height", innerH);
    this.gRoot.attr(
      "transform",
      `translate(${this.margin.left},${this.margin.top})`
    );

    const plotW = innerW - this.margin.left - this.margin.right;
    const plotH = innerH - this.margin.top - this.margin.bottom;

    // ---- Scales ----
    const x = d3.scaleTime().domain([t0, t1]).range([0, plotW]);

    const y = d3
      .scaleBand<string>()
      .domain(this.data.gates)
      .range([0, plotH])
      .paddingInner(0.25);

    // ---- Axes + layers ----
    this.renderAxesAndLayers(x, y, plotW);

    // ---- Color ----
    const color = buildColorScale(this.data, colorDimension);

    // ---- Render (orden correcto) ----
    if (this.groundG) renderGroundLines(this.groundG, this.data, x, y);
    if (this.scheduledG) renderScheduledBars(this.scheduledG, this.data, x, y);

    // ✅ primero barras actual
    if (this.barsG) {
      renderActualBars(
        this.barsG,
        this.data,
        x,
        y,
        color,
        this.selectionManager,
        this.host,
        colorDimension
      );
      // ✅ después dentado pegado y mismo color
      renderTowEdges(this.barsG, this.data, x, y);
    }

    // ✅ texto al final arriba de todo
    if (this.labelsG) renderActualLabels(this.labelsG, this.data, x, y);

    // ✅ Línea NOW (si está en el rango visible)
    if (this.nowLineG) renderNowLine(this.nowLineG, x, plotH, [t0, t1]);
  }

  private renderAxesAndLayers(
    x: d3.ScaleTime<number, number>,
    y: d3.ScaleBand<string>,
    plotW: number
  ): void {
    if (!this.xAxisG) {
      this.xAxisG = this.gRoot.append("g").attr("class", "x-axis");
      this.yAxisG = this.gRoot.append("g").attr("class", "y-axis");

      // Layers (background → foreground)
      this.groundG = this.gRoot.append("g").attr("class", "ground");
      this.scheduledG = this.gRoot.append("g").attr("class", "scheduled");
      this.barsG = this.gRoot.append("g").attr("class", "bars");
      this.nowLineG = this.gRoot.append("g").attr("class", "now-line-group");
      this.labelsG = this.gRoot.append("g").attr("class", "labels");
    }

    const xAxis = d3
      .axisTop(x)
      .ticks(d3.timeHour.every(1))
      .tickFormat(d3.timeFormat("%H:%M") as any);

    this.xAxisG.call(xAxis as any);

    const yAxis = d3.axisLeft(y).tickSize(0);
    this.yAxisG.call(yAxis as any);

    const grid = this.gRoot
      .selectAll<SVGLineElement, string>("line.row-grid")
      .data(y.domain(), (d) => d);

    grid
      .enter()
      .append("line")
      .attr("class", "row-grid")
      .merge(grid as any)
      .attr("x1", 0)
      .attr("x2", plotW)
      .attr("y1", (d) => (y(d) ?? 0) + y.bandwidth() / 2)
      .attr("y2", (d) => (y(d) ?? 0) + y.bandwidth() / 2);

    grid.exit().remove();
  }

  // ✅ Apply filters and re-render
  private applyFiltersAndUpdate(): void {
    if (!this.data) return;

    // Get filter values from UI
    const dateInput = document.getElementById("filter-date") as HTMLInputElement | null;
    const timeInput = document.getElementById("filter-time") as HTMLInputElement | null;
    const terminalInput = document.getElementById("filter-terminal") as HTMLInputElement | null;
    const gateInput = document.getElementById("filter-gate") as HTMLInputElement | null;
    const airlineInput = document.getElementById("filter-airline") as HTMLInputElement | null;
    const flightInput = document.getElementById("filter-flight") as HTMLInputElement | null;
    const tailInput = document.getElementById("filter-tail") as HTMLInputElement | null;

    // Parse filter values
    this.filters = {
      date: dateInput?.value ? new Date(dateInput.value) : null,
      timeMin: 0,
      timeMax: 24,
      terminal: terminalInput?.value || "",
      gate: gateInput?.value || "",
      airline: airlineInput?.value || "",
      flightNumber: flightInput?.value || "",
      tail: tailInput?.value || ""
    };

    // Parse time range if provided
    if (timeInput?.value) {
      const timeParts = timeInput.value.split("-");
      if (timeParts.length === 2) {
        this.filters.timeMin = parseInt(timeParts[0]) || 0;
        this.filters.timeMax = parseInt(timeParts[1]) || 24;
      }
    }



    const filteredRows = applyFilters(this.data.rows, this.filters);



    // Update gates based on filtered data
    const filteredGates = Array.from(new Set(filteredRows.map((d) => d.gate))).sort();

    // Adjust timeDomain based on time range (viewport control, not filter)
    let adjustedTimeDomain: [Date, Date] = this.data.timeDomain;

    if (this.filters.timeMin > 0 || this.filters.timeMax < 24) {
      // Get the date from the first data point
      const baseDate = this.data.timeDomain[0];
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const day = baseDate.getDate();

      // Create new time domain with specified hours
      const startDate = new Date(year, month, day, this.filters.timeMin, 0, 0);
      const endDate = new Date(year, month, day, this.filters.timeMax, 0, 0);

      adjustedTimeDomain = [startDate, endDate];

    }

    // Re-render with filtered data and adjusted time domain
    const filteredData: ParsedData = {
      rows: filteredRows,
      gates: filteredGates,
      timeDomain: adjustedTimeDomain
    };

    // Clear SVG layers
    if (this.groundG) this.groundG.selectAll("*").remove();
    if (this.scheduledG) this.scheduledG.selectAll("*").remove();
    if (this.barsG) this.barsG.selectAll("*").remove();
    if (this.labelsG) this.labelsG.selectAll("*").remove();
    if (this.nowLineG) this.nowLineG.selectAll("*").remove();

    // Re-render (simplified - sin viewport update para mantener simple)
    // En update() hay lógica completa, aquí hacemos lo mismo
    const viewport = { width: this.scroll.clientWidth, height: this.scroll.clientHeight };

    // Recalcular scales con datos filtrados
    const t0 = filteredData.timeDomain[0];
    const t1 = filteredData.timeDomain[1];
    const hours = Math.ceil((t1.getTime() - t0.getTime()) / (60 * 60 * 1000));

    const innerW = Math.max(viewport.width, this.margin.left + this.margin.right + hours * this.pxPerHour);
    const innerH = Math.max(viewport.height, this.margin.top + this.margin.bottom + filteredData.gates.length * this.rowHeight);

    this.svg.attr("width", innerW).attr("height", innerH);
    this.gRoot.attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    const plotW = innerW - this.margin.left - this.margin.right;
    const plotH = innerH - this.margin.top - this.margin.bottom;

    const x = d3.scaleTime().domain([t0, t1]).range([0, plotW]);
    const y = d3.scaleBand<string>().domain(filteredData.gates).range([0, plotH]).paddingInner(0.25);

    // Re-render axes
    this.renderAxesAndLayers(x, y, plotW);

    // Color
    const colorDimension = (this.formattingSettings?.displayCard.colorDimension.value as any)?.value as string || "airline";
    const color = buildColorScale(filteredData, colorDimension);

    // Render
    if (this.groundG) renderGroundLines(this.groundG, filteredData, x, y);
    if (this.scheduledG) renderScheduledBars(this.scheduledG, filteredData, x, y);
    if (this.barsG) {
      renderActualBars(this.barsG, filteredData, x, y, color, this.selectionManager, this.host, colorDimension);
      renderTowEdges(this.barsG, filteredData, x, y);
    }
    if (this.labelsG) renderActualLabels(this.labelsG, filteredData, x, y);
    if (this.nowLineG) renderNowLine(this.nowLineG, x, plotH, [t0, t1]);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    if (!this.formattingSettings) {
      this.formattingSettings =
        this.formattingSettingsService.populateFormattingSettingsModel(
          VisualFormattingSettingsModel,
          null as any
        );
    }
    return this.formattingSettingsService.buildFormattingModel(
      this.formattingSettings
    );
  }
}
