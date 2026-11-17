import type { Report, ReportInput } from "../types";
import { demoReport } from "../types";
import { isSupabaseConfigured, supabase } from "./supabase";
import { monthStart } from "./format";

const KEY = "warp-knitting-reports-v1";
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function localRead(): Report[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as Report[] : [clone(demoReport)];
  } catch { return [clone(demoReport)]; }
}
function localWrite(rows: Report[]) { localStorage.setItem(KEY, JSON.stringify(rows)); }

function toDb(r: ReportInput) {
  return {
    reporting_date: r.reportingDate,
    production_date: r.productionDate,
    reporting_month: monthStart(r.reportingDate),
    monthly_order_mtr: r.monthlyOrderMtr,
    status: r.status,
    remarks: r.remarks,
    production_data: {
      monthly_production_mtr: r.monthlyProductionMtr,
      monthly_production_kg: r.monthlyProductionKg,
      monthly_production_rolls: r.monthlyProductionRolls,
      sap_confirmation_mtr: r.sapConfirmationMtr,
      daily_production_mtr: r.dailyProductionMtr,
      daily_production_kg: r.dailyProductionKg,
      daily_production_rolls: r.dailyProductionRolls,
      daily_target_mtr: r.dailyTargetMtr,
      columbia_mtr: r.columbiaMtr,
      columbia_kg: r.columbiaKg,
      columbia_rolls: r.columbiaRolls,
      columbia_target_mtr: r.columbiaTargetMtr,
      apm_yarn_kg: r.apmYarnKg,
      sap_yarn_kg: r.sapYarnKg
    },
    stocks: r.stocks.map(s => ({ category:s.category, quantity_mtr:s.mtr, quantity_kg:s.kg, quantity_rolls:s.rolls })),
    resources: {
      total_present:r.totalPresent, total_required:r.totalRequired,
      shifting_present:r.shiftingPresent, shifting_required:r.shiftingRequired,
      general_present:r.generalPresent, general_required:r.generalRequired,
      leave_count:r.leaveCount, warping_machines:r.warpingMachines,
      knitting_machines:r.knittingMachines
    }
  };
}

function fromDb(row: any): Report {
  const p = row.production_data ?? {};
  const x = row.resource_data ?? {};
  return {
    id: row.id, reportingDate: row.reporting_date, productionDate: row.production_date,
    monthlyOrderMtr: Number(row.monthly_order_mtr || 0),
    monthlyProductionMtr: Number(p.monthly_production_mtr || 0),
    monthlyProductionKg: Number(p.monthly_production_kg || 0),
    monthlyProductionRolls: Number(p.monthly_production_rolls || 0),
    sapConfirmationMtr: Number(p.sap_confirmation_mtr || 0),
    dailyProductionMtr: Number(p.daily_production_mtr || 0),
    dailyProductionKg: Number(p.daily_production_kg || 0),
    dailyProductionRolls: Number(p.daily_production_rolls || 0),
    dailyTargetMtr: Number(p.daily_target_mtr || 0),
    columbiaMtr: Number(p.columbia_mtr || 0), columbiaKg: Number(p.columbia_kg || 0),
    columbiaRolls: Number(p.columbia_rolls || 0), columbiaTargetMtr: Number(p.columbia_target_mtr || 0),
    apmYarnKg: Number(p.apm_yarn_kg || 0), sapYarnKg: Number(p.sap_yarn_kg || 0),
    stocks: (row.stock_data ?? []).map((s: any) => ({
      category:s.category, mtr:Number(s.quantity_mtr || 0), kg:Number(s.quantity_kg || 0), rolls:Number(s.quantity_rolls || 0)
    })),
    totalPresent:Number(x.total_present || 0), totalRequired:Number(x.total_required || 0),
    shiftingPresent:Number(x.shifting_present || 0), shiftingRequired:Number(x.shifting_required || 0),
    generalPresent:Number(x.general_present || 0), generalRequired:Number(x.general_required || 0),
    leaveCount:Number(x.leave_count || 0), warpingMachines:Number(x.warping_machines || 0),
    knittingMachines:Number(x.knitting_machines || 0), remarks:row.remarks || "",
    status:row.status, createdAt:row.created_at, updatedAt:row.updated_at
  };
}

export async function getReports(): Promise<Report[]> {
  if (!isSupabaseConfigured || !supabase) return localRead().sort((a,b)=>b.reportingDate.localeCompare(a.reportingDate));
  const { data, error } = await supabase.from("daily_reports").select("*, production_data(*), stock_data(*), resource_data(*)").order("reporting_date", { ascending:false });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function saveReport(input: ReportInput): Promise<Report> {
  const now = new Date().toISOString();
  if (!isSupabaseConfigured || !supabase) {
    const rows = localRead();
    const existing = rows.find(r => r.reportingDate === input.reportingDate);
    const saved: Report = { ...clone(input), id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt:now } as Report;
    localWrite([saved, ...rows.filter(r => r.reportingDate !== input.reportingDate)]);
    return saved;
  }

  const payload = toDb(input);
  const { data: main, error: mainError } = await supabase
    .from("daily_reports")
    .upsert({
      reporting_date:payload.reporting_date,
      production_date:payload.production_date,
      reporting_month:payload.reporting_month,
      monthly_order_mtr:payload.monthly_order_mtr,
      status:payload.status,
      remarks:payload.remarks,
      updated_at:now,
      submitted_at:payload.status === "submitted" ? now : null
    }, { onConflict:"reporting_date" })
    .select().single();
  if (mainError) throw mainError;

  const reportId = main.id;
  const p = payload.production_data;
  const { error: pErr } = await supabase.from("production_data").upsert({ report_id:reportId, ...p });
  if (pErr) throw pErr;
  const { error: sDelete } = await supabase.from("stock_data").delete().eq("report_id", reportId);
  if (sDelete) throw sDelete;
  const { error: sErr } = await supabase.from("stock_data").insert(payload.stocks.map(s=>({report_id:reportId,...s})));
  if (sErr) throw sErr;
  const { error: rErr } = await supabase.from("resource_data").upsert({report_id:reportId,...payload.resources});
  if (rErr) throw rErr;
  return { ...clone(input), id:reportId, createdAt:main.created_at, updatedAt:now } as Report;
}

export async function deleteLocalReport(id: string) {
  if (isSupabaseConfigured && supabase) throw new Error("Deleting submitted reports is disabled in this application.");
  localWrite(localRead().filter(r=>r.id!==id));
}
