import type { Report } from "../types";
import { achievement, number, dateLabel } from "./format";

export function makeWhatsAppReport(r: Report) {
  const stock = (category: string) => r.stocks.find(s => s.category === category);
  const line = (s: ReturnType<typeof stock>) => s
    ? `${number(s.mtr)} MTR | ${number(s.kg, 2)} KG | ${number(s.rolls)} Rolls`
    : "Not provided";
  const dailyAchievement = achievement(r.dailyProductionMtr, r.dailyTargetMtr);
  const colAchievement = achievement(r.columbiaMtr, r.columbiaTargetMtr);
  const monthlyAchievement = achievement(r.monthlyProductionMtr, r.monthlyOrderMtr);

  return [
    "*WARP KNITTING DAILY PRODUCTION REPORT*",
    `REPORTING DATE: ${dateLabel(r.reportingDate)}`,
    "",
    "*MONTHLY PRODUCTION*",
    `Order Qty: ${number(r.monthlyOrderMtr)} MTR`,
    `Total Production: ${number(r.monthlyProductionMtr)} MTR`,
    `Weight: ${number(r.monthlyProductionKg, 2)} KG`,
    `Rolls: ${number(r.monthlyProductionRolls)}`,
    `SAP Confirmation: ${number(r.sapConfirmationMtr)} MTR`,
    `Monthly Achievement: ${number(monthlyAchievement, 2)}%`,
    "",
    `*DAILY PRODUCTION (${dateLabel(r.productionDate)})*`,
    `Production: ${number(r.dailyProductionMtr)} MTR`,
    `Weight: ${number(r.dailyProductionKg, 2)} KG`,
    `Rolls: ${number(r.dailyProductionRolls)}`,
    `Target: ${number(r.dailyTargetMtr)} MTR`,
    `Achievement: ${number(dailyAchievement, 2)}%`,
    "",
    `*COLUMBIA PRODUCTION (${dateLabel(r.productionDate)})*`,
    `Production: ${number(r.columbiaMtr)} MTR`,
    `Weight: ${number(r.columbiaKg, 2)} KG`,
    `Rolls: ${number(r.columbiaRolls)}`,
    `Target: ${number(r.columbiaTargetMtr)} MTR`,
    `Achievement: ${number(colAchievement, 2)}%`,
    "",
    "*GREIGE FABRIC STOCK*",
    `Physical Greige: ${line(stock("Physical Greige"))}`,
    `Glostom Greige: ${line(stock("Glostom Greige"))}`,
    "",
    "*SAP GREIGE STOCK*",
    `SAP Greige: ${line(stock("SAP Greige"))}`,
    `Glostom SAP: ${line(stock("Glostom SAP"))}`,
    "",
    "*OTHER FABRIC STOCK*",
    `Columbia: ${line(stock("Columbia"))}`,
    `YOC-TNF: ${line(stock("YOC-TNF"))}`,
    `3D Mesh: ${line(stock("3D Mesh"))}`,
    "",
    "*YARN STOCK*",
    `APM Yarn Stock: ${number(r.apmYarnKg, 2)} KG`,
    `SAP Yarn Stock: ${number(r.sapYarnKg, 2)} KG`,
    `Difference: ${number(r.apmYarnKg - r.sapYarnKg, 2)} KG`,
    "",
    "*MANPOWER*",
    `Total: ${r.totalPresent}/${r.totalRequired}`,
    `Shifting: ${r.shiftingPresent}/${r.shiftingRequired}`,
    `General: ${r.generalPresent}/${r.generalRequired}`,
    `Leave: ${r.leaveCount}`,
    "",
    "*MACHINES*",
    `Warping: ${number(r.warpingMachines)}`,
    `Knitting: ${number(r.knittingMachines)}`,
    ...(r.remarks.trim() ? ["", "*REMARKS*", r.remarks.trim()] : [])
  ].join("\n");
}
