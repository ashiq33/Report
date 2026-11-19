import * as XLSX from "xlsx";
import type { ReportInput, StockCategory } from "../types";
import { emptyReport, STOCK_CATEGORIES } from "../types";

type Row = Record<string, unknown>;
const clean = (v: unknown) => String(v ?? "").trim();
const numeric = (v: unknown) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const get = (row: Row, key: string) => {
  const found = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === key.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return found ? row[found] : undefined;
};
const asDate = (v: unknown, fallback: string) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = clean(v);
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
};

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const production = [{
    ReportingDate: "2026-11-17", ProductionDate: "2026-11-16",
    MonthlyOrderMTR: 682365, MonthlyProductionMTR: 323086,
    MonthlyProductionKG: 40807.92, MonthlyProductionRolls: 1837,
    SAPConfirmationMTR: 323086, DailyProductionMTR: 32694,
    DailyProductionKG: 3689.04, DailyProductionRolls: 157,
    DailyTargetMTR: 26200, ColumbiaMTR: 10260, ColumbiaKG: 1363.10,
    ColumbiaRolls: 54, ColumbiaTargetMTR: 15360, Remarks: ""
  }];
  const stock = [
    { Category:"Physical Greige", MTR:409104, KG:57834.32, Rolls:2564 },
    { Category:"Glostom Greige", MTR:86471, KG:13023.72, Rolls:662 },
    { Category:"SAP Greige", MTR:404286, KG:"", Rolls:2624 },
    { Category:"Glostom SAP", MTR:87344, KG:"", Rolls:667 },
    { Category:"Columbia", MTR:27472, KG:3649.45, Rolls:151 },
    { Category:"YOC-TNF", MTR:4720, KG:1179.05, Rolls:59 },
    { Category:"3D Mesh", MTR:10322, KG:5189.60, Rolls:259 }
  ];
  const resources = [
    ["Field","Value"],["APM_Yarn_KG",453252.01],["SAP_Yarn_KG",453152.21],
    ["TotalPresent",21],["TotalRequired",25],["ShiftingPresent",14],
    ["ShiftingRequired",17],["GeneralPresent",7],["GeneralRequired",8],
    ["Leave",4],["WarpingMachines",6],["KnittingMachines",12]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(production), "Production");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stock), "Stock");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resources), "Resources");
  XLSX.writeFile(wb, "warp-knitting-daily-report-template.xlsx");
}

export async function parseWorkbook(file: File): Promise<{ report: ReportInput; errors: string[]; warnings: string[] }> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const errors: string[] = [];
  const warnings: string[] = [];
  const sheetRows = (name: string): Row[] => {
    const sheet = wb.Sheets[name];
    return sheet ? XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" }) : [];
  };
  const p = sheetRows("Production")[0] ?? {};
  const report = emptyReport();
  const assignNum = (key: keyof ReportInput, source: string) => {
    const v = numeric(get(p, source));
    if (Number.isNaN(v) || v < 0) errors.push(`${source} must be a valid non-negative number.`);
    else (report as unknown as Record<string, unknown>)[key] = v;
  };
  const rd = asDate(get(p, "ReportingDate"), "");
  const pd = asDate(get(p, "ProductionDate"), "");
  if (!rd) errors.push("ReportingDate is missing or invalid.");
  if (!pd) errors.push("ProductionDate is missing or invalid.");
  report.reportingDate = rd || report.reportingDate;
  report.productionDate = pd || report.productionDate;

  const mappings: [keyof ReportInput, string][] = [
    ["monthlyOrderMtr","MonthlyOrderMTR"],["monthlyProductionMtr","MonthlyProductionMTR"],
    ["monthlyProductionKg","MonthlyProductionKG"],["monthlyProductionRolls","MonthlyProductionRolls"],
    ["sapConfirmationMtr","SAPConfirmationMTR"],["dailyProductionMtr","DailyProductionMTR"],
    ["dailyProductionKg","DailyProductionKG"],["dailyProductionRolls","DailyProductionRolls"],
    ["dailyTargetMtr","DailyTargetMTR"],["columbiaMtr","ColumbiaMTR"],
    ["columbiaKg","ColumbiaKG"],["columbiaRolls","ColumbiaRolls"],
    ["columbiaTargetMtr","ColumbiaTargetMTR"]
  ];
  mappings.forEach(([key, source]) => assignNum(key, source));
  report.remarks = clean(get(p, "Remarks"));

  const stockRows = sheetRows("Stock");
  if (!stockRows.length) warnings.push("Stock worksheet is missing or empty.");
  const seen = new Set<string>();
  report.stocks = STOCK_CATEGORIES.map(category => {
    const row = stockRows.find(r => clean(get(r, "Category")).toLowerCase() === category.toLowerCase());
    if (!row) warnings.push(`Stock category "${category}" was not found; values default to zero.`);
    seen.add(category);
    const vals = [numeric(get(row ?? {}, "MTR")), numeric(get(row ?? {}, "KG")), numeric(get(row ?? {}, "Rolls"))];
    if (vals.some(Number.isNaN) || vals.some(v => v < 0)) errors.push(`Invalid stock quantity for ${category}.`);
    return { category: category as StockCategory, mtr: Number.isNaN(vals[0]) ? 0 : vals[0], kg: Number.isNaN(vals[1]) ? 0 : vals[1], rolls: Number.isNaN(vals[2]) ? 0 : vals[2] };
  });

  const resRows = sheetRows("Resources");
  const res: Record<string, unknown> = {};
  resRows.forEach(row => { res[clean(get(row,"Field"))] = get(row,"Value"); });
  const resourceMap: [keyof ReportInput,string][] = [
    ["apmYarnKg","APM_Yarn_KG"],["sapYarnKg","SAP_Yarn_KG"],
    ["totalPresent","TotalPresent"],["totalRequired","TotalRequired"],
    ["shiftingPresent","ShiftingPresent"],["shiftingRequired","ShiftingRequired"],
    ["generalPresent","GeneralPresent"],["generalRequired","GeneralRequired"],
    ["leaveCount","Leave"],["warpingMachines","WarpingMachines"],
    ["knittingMachines","KnittingMachines"]
  ];
  resourceMap.forEach(([key, source]) => {
    const v = numeric(res[source]);
    if (Number.isNaN(v) || v < 0) errors.push(`${source} must be a valid non-negative number.`);
    else (report as unknown as Record<string, unknown>)[key] = v;
  });
  if (!wb.Sheets.Production) errors.push('Required worksheet "Production" is missing.');
  if (!wb.Sheets.Stock) warnings.push('Worksheet "Stock" is missing.');
  if (!wb.Sheets.Resources) warnings.push('Worksheet "Resources" is missing.');
  return { report, errors, warnings };
}
