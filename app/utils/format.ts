export function formatUSD(amount: number | null | undefined): string {
  try {
    if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
    return `$${amount.toFixed(2)}`;
  }
}

export type CostScope = "message" | "session" | "project";
export type CostScale = { greenMax: number; yellowMax: number; redMax?: number };

// Unified thresholds for all scopes:
// green < 0.50, yellow 0.50–0.99, red >= 1.00
export function costColorClass(amount: number | null | undefined, _scope: CostScope, scale?: CostScale): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "text-gray-400";
  if (scale) {
    if (amount <= scale.greenMax) return "text-green-500";
    if (amount <= scale.yellowMax) return "text-amber-500";
    return "text-red-500";
  }
  if (amount < 0.5) return "text-green-500";
  if (amount < 1.0) return "text-amber-500";
  return "text-red-500";
}

// Discrete gradient (11 stops), left→right = low→high cost.
export const COST_GRADIENT = [
  "#00ff00", "#40ff00", "#80ff00", "#bfff00",
  "#ffff00", "#ffff00", "#ffff00",
  "#ffbf00", "#ff8000", "#ff4000", "#ff0000",
] as const;

// Map amount to a color hex from COST_GRADIENT using dynamic scale.
export function costColorHex(amount: number | null | undefined, scale?: CostScale): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "#9ca3af"; // gray-400
  const n = COST_GRADIENT.length;
  // Default fallback thresholds
  const greenMax = scale?.greenMax ?? 0.5;
  const yellowMax = Math.max(greenMax, scale?.yellowMax ?? 1.0);
  const redMax = Math.max(yellowMax + 1e-9, scale?.redMax ?? yellowMax * 4);

  const greenLen = 4; // indices 0..3
  const yellowLen = 3; // 4..6
  const redLen = n - (greenLen + yellowLen); // 4 => 7..10
  const greenEnd = greenLen - 1;
  const yellowStart = greenLen;
  const yellowEnd = yellowStart + yellowLen - 1;
  const redStart = yellowEnd + 1;

  let idx: number;
  if (amount <= greenMax) {
    const r = greenMax > 0 ? amount / greenMax : 0;
    idx = Math.floor(r * greenEnd + 1e-9);
  } else if (amount <= yellowMax) {
    const denom = Math.max(1e-9, yellowMax - greenMax);
    const r = (amount - greenMax) / denom; // 0..1
    idx = yellowStart + Math.floor(r * (yellowLen - 1) + 1e-9);
  } else {
    const denom = Math.max(1e-9, redMax - yellowMax);
    const r = Math.min(1, (amount - yellowMax) / denom); // 0..1, clamp
    idx = redStart + Math.floor(r * (redLen - 1) + 1e-9);
  }
  if (idx < 0) idx = 0;
  if (idx >= n) idx = n - 1;
  return COST_GRADIENT[idx];
}
