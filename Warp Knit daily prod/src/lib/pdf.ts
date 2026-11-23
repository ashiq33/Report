import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Report } from "../types";
import { makeWhatsAppReport } from "./reportText";
import { dateLabel, number, achievement } from "./format";

export function downloadReportPdf(r: Report) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("WARP KNITTING DAILY PRODUCTION REPORT", 14, 18);
  doc.setFontSize(10);
  doc.text(`Reporting date: ${dateLabel(r.reportingDate)} | Production date: ${dateLabel(r.productionDate)}`, 14, 26);
  autoTable(doc, {
    startY: 34,
    head: [["Production KPI", "Value", "Unit"]],
    body: [
      ["Monthly order", number(r.monthlyOrderMtr), "MTR"],
      ["Monthly production", number(r.monthlyProductionMtr), "MTR"],
      ["Monthly production weight", number(r.monthlyProductionKg,2), "KG"],
      ["Monthly rolls", number(r.monthlyProductionRolls), "Rolls"],
      ["SAP confirmation", number(r.sapConfirmationMtr), "MTR"],
      ["Daily production", number(r.dailyProductionMtr), "MTR"],
      ["Daily weight", number(r.dailyProductionKg,2), "KG"],
      ["Daily rolls", number(r.dailyProductionRolls), "Rolls"],
      ["Daily target", number(r.dailyTargetMtr), "MTR"],
      ["Daily achievement", number(achievement(r.dailyProductionMtr,r.dailyTargetMtr),2), "%"],
      ["Columbia production", number(r.columbiaMtr), "MTR"],
      ["Columbia target", number(r.columbiaTargetMtr), "MTR"],
      ["Columbia achievement", number(achievement(r.columbiaMtr,r.columbiaTargetMtr),2), "%"]
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 48, 78] }
  });
  const stockBody = r.stocks.map(s => [s.category, number(s.mtr), number(s.kg,2), number(s.rolls)]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Stock category", "MTR", "KG", "Rolls"]],
    body: stockBody,
    theme: "grid",
    headStyles: { fillColor: [20, 48, 78] }
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Resource", "Present / Value", "Required"]],
    body: [
      ["Total manpower", number(r.totalPresent), number(r.totalRequired)],
      ["Shifting", number(r.shiftingPresent), number(r.shiftingRequired)],
      ["General", number(r.generalPresent), number(r.generalRequired)],
      ["Leave", number(r.leaveCount), "—"],
      ["Warping machines", number(r.warpingMachines), "—"],
      ["Knitting machines", number(r.knittingMachines), "—"],
      ["APM yarn stock (KG)", number(r.apmYarnKg,2), "—"],
      ["SAP yarn stock (KG)", number(r.sapYarnKg,2), "—"]
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 48, 78] }
  });
  if (r.remarks.trim()) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Remarks"]],
      body: [[r.remarks]],
      theme: "grid",
      headStyles: { fillColor: [20, 48, 78] }
    });
  }
  doc.save(`warp-knitting-report-${r.reportingDate}.pdf`);
  void makeWhatsAppReport;
}
