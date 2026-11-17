export type Role = "admin" | "boss";
export type ReportStatus = "draft" | "submitted";

export type StockCategory =
  | "Physical Greige"
  | "Glostom Greige"
  | "SAP Greige"
  | "Glostom SAP"
  | "Columbia"
  | "YOC-TNF"
  | "3D Mesh";

export interface StockItem {
  category: StockCategory;
  mtr: number;
  kg: number;
  rolls: number;
}

export interface Report {
  id: string;
  reportingDate: string;
  productionDate: string;
  monthlyOrderMtr: number;
  monthlyProductionMtr: number;
  monthlyProductionKg: number;
  monthlyProductionRolls: number;
  sapConfirmationMtr: number;
  dailyProductionMtr: number;
  dailyProductionKg: number;
  dailyProductionRolls: number;
  dailyTargetMtr: number;
  columbiaMtr: number;
  columbiaKg: number;
  columbiaRolls: number;
  columbiaTargetMtr: number;
  stocks: StockItem[];
  apmYarnKg: number;
  sapYarnKg: number;
  totalPresent: number;
  totalRequired: number;
  shiftingPresent: number;
  shiftingRequired: number;
  generalPresent: number;
  generalRequired: number;
  leaveCount: number;
  warpingMachines: number;
  knittingMachines: number;
  remarks: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReportInput = Omit<Report, "id" | "createdAt" | "updatedAt"> & { id?: string };

export const STOCK_CATEGORIES: StockCategory[] = [
  "Physical Greige", "Glostom Greige", "SAP Greige", "Glostom SAP",
  "Columbia", "YOC-TNF", "3D Mesh"
];

export const emptyReport = (date = new Date().toISOString().slice(0, 10)): ReportInput => ({
  reportingDate: date,
  productionDate: date,
  monthlyOrderMtr: 0,
  monthlyProductionMtr: 0,
  monthlyProductionKg: 0,
  monthlyProductionRolls: 0,
  sapConfirmationMtr: 0,
  dailyProductionMtr: 0,
  dailyProductionKg: 0,
  dailyProductionRolls: 0,
  dailyTargetMtr: 0,
  columbiaMtr: 0,
  columbiaKg: 0,
  columbiaRolls: 0,
  columbiaTargetMtr: 0,
  stocks: STOCK_CATEGORIES.map(category => ({ category, mtr: 0, kg: 0, rolls: 0 })),
  apmYarnKg: 0,
  sapYarnKg: 0,
  totalPresent: 0,
  totalRequired: 0,
  shiftingPresent: 0,
  shiftingRequired: 0,
  generalPresent: 0,
  generalRequired: 0,
  leaveCount: 0,
  warpingMachines: 0,
  knittingMachines: 0,
  remarks: "",
  status: "draft"
});

export const demoReport: Report = {
  ...emptyReport("2026-11-17"),
  id: "demo-2026-11-17",
  productionDate: "2026-11-16",
  monthlyOrderMtr: 682365,
  monthlyProductionMtr: 323086,
  monthlyProductionKg: 40807.92,
  monthlyProductionRolls: 1837,
  sapConfirmationMtr: 323086,
  dailyProductionMtr: 32694,
  dailyProductionKg: 3689.04,
  dailyProductionRolls: 157,
  dailyTargetMtr: 26200,
  columbiaMtr: 10260,
  columbiaKg: 1363.10,
  columbiaRolls: 54,
  columbiaTargetMtr: 15360,
  stocks: [
    { category: "Physical Greige", mtr: 409104, kg: 57834.32, rolls: 2564 },
    { category: "Glostom Greige", mtr: 86471, kg: 13023.72, rolls: 662 },
    { category: "SAP Greige", mtr: 404286, kg: 0, rolls: 2624 },
    { category: "Glostom SAP", mtr: 87344, kg: 0, rolls: 667 },
    { category: "Columbia", mtr: 27472, kg: 3649.45, rolls: 151 },
    { category: "YOC-TNF", mtr: 4720, kg: 1179.05, rolls: 59 },
    { category: "3D Mesh", mtr: 10322, kg: 5189.60, rolls: 259 }
  ],
  apmYarnKg: 453252.01,
  sapYarnKg: 453152.21,
  totalPresent: 21,
  totalRequired: 25,
  shiftingPresent: 14,
  shiftingRequired: 17,
  generalPresent: 7,
  generalRequired: 8,
  leaveCount: 4,
  warpingMachines: 6,
  knittingMachines: 12,
  remarks: "",
  status: "submitted",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
