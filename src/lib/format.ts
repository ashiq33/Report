export const number = (value: number | null | undefined, decimals = 0) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value || 0));

export const percent = (value: number) => `${number(value, 2)}%`;

export const achievement = (actual: number, target: number) =>
  target > 0 ? (actual / target) * 100 : 0;

export const safeRatio = (actual: number, target: number) =>
  target > 0 ? actual / target : 0;

export const dateLabel = (date: string) => {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
};

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
