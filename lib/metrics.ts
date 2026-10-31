import type { Fillup } from "./api";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dec = (n: number, d = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const int = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/** Accepts "38,5" or "38.5" or "1.234,56" and returns a number (or NaN). */
export function parseNum(v: string): number {
  const s = v.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normalized);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
};
export const dayLabel = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};
export const fullDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

/** Local date as YYYY-MM-DD (not UTC, so 22h in São Paulo is still "today"). */
export function localISO(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type Enriched = Fillup & { kml: number; pricePerLiter: number; costPerKm: number; daysSincePrev: number | null };

export function enrich(list: Fillup[]): Enriched[] {
  const sorted = [...list].sort((a, b) => (a.filled_on === b.filled_on ? a.id - b.id : a.filled_on < b.filled_on ? -1 : 1));
  return sorted.map((f, i) => {
    const prev = sorted[i - 1];
    const days = prev ? Math.round((Date.parse(f.filled_on) - Date.parse(prev.filled_on)) / 86400000) : null;
    return {
      ...f,
      kml: f.km_driven / f.liters,
      pricePerLiter: f.total_cost / f.liters,
      costPerKm: f.total_cost / f.km_driven,
      daysSincePrev: days,
    };
  });
}

type Agg = { km: number; liters: number; cost: number; count: number };
const sum = (rows: Fillup[]): Agg =>
  rows.reduce((a, r) => ({ km: a.km + r.km_driven, liters: a.liters + r.liters, cost: a.cost + r.total_cost, count: a.count + 1 }), {
    km: 0,
    liters: 0,
    cost: 0,
    count: 0,
  });

export type Summary = ReturnType<typeof summarize>;

export function summarize(list: Fillup[], today = new Date()) {
  const rows = enrich(list);
  const all = sum(rows);
  const avgKml = all.liters ? all.km / all.liters : 0;
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  const ym = localISO(today).slice(0, 7);
  const prevYm = localISO(new Date(today.getFullYear(), today.getMonth() - 1, 15)).slice(0, 7);
  const thisMonth = sum(rows.filter((r) => r.filled_on.startsWith(ym)));
  const lastMonth = sum(rows.filter((r) => r.filled_on.startsWith(prevYm)));

  // Spending pace over the last 90 days, scaled to 30 days.
  const cutoff = localISO(new Date(today.getTime() - 90 * 86400000));
  const recent = rows.filter((r) => r.filled_on >= cutoff);
  const recentAgg = sum(recent);
  const firstRecent = recent[0]?.filled_on;
  const spanDays = firstRecent ? Math.max(30, (today.getTime() - Date.parse(firstRecent)) / 86400000) : 0;
  const monthlyPace = spanDays ? (recentAgg.cost / spanDays) * 30 : 0;
  const monthlyKmPace = spanDays ? (recentAgg.km / spanDays) * 30 : 0;

  const gaps = rows.map((r) => r.daysSincePrev).filter((d): d is number => d !== null && d >= 0);
  const avgDaysBetween = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

  const city = sum(rows.filter((r) => !r.had_trip));
  const trip = sum(rows.filter((r) => r.had_trip));

  const kmls = rows.map((r) => r.kml);
  const best = rows.length ? rows.reduce((a, b) => (b.kml > a.kml ? b : a)) : null;
  const worst = rows.length ? rows.reduce((a, b) => (b.kml < a.kml ? b : a)) : null;

  // Per month (for charts)
  const byMonth = new Map<string, Agg>();
  for (const r of rows) {
    const k = r.filled_on.slice(0, 7);
    const a = byMonth.get(k) || { km: 0, liters: 0, cost: 0, count: 0 };
    byMonth.set(k, { km: a.km + r.km_driven, liters: a.liters + r.liters, cost: a.cost + r.total_cost, count: a.count + 1 });
  }
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-12)
    .map(([k, a]) => ({ month: monthLabel(k), cost: a.cost, km: a.km, kml: a.liters ? a.km / a.liters : 0 }));

  // Per station
  // Group stations ignoring case/spaces; show the spelling used most.
  const byStation = new Map<string, Agg & { spell: Map<string, number> }>();
  for (const r of rows) {
    const name = r.station?.trim() || "Sem posto";
    const k = name.toLowerCase();
    const a = byStation.get(k) || { km: 0, liters: 0, cost: 0, count: 0, spell: new Map<string, number>() };
    a.spell.set(name, (a.spell.get(name) || 0) + 1);
    byStation.set(k, { km: a.km + r.km_driven, liters: a.liters + r.liters, cost: a.cost + r.total_cost, count: a.count + 1, spell: a.spell });
  }
  const topSpelling = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const stations = [...byStation.values()]
    .map((a) => ({ name: topSpelling(a.spell), count: a.count, pricePerLiter: a.cost / a.liters, kml: a.km / a.liters, cost: a.cost }))
    .sort((a, b) => b.count - a.count || a.pricePerLiter - b.pricePerLiter);

  const trips = rows.filter((r) => r.had_trip && r.trip_place).reverse();

  return {
    rows,
    count: all.count,
    totalKm: all.km,
    totalLiters: all.liters,
    totalCost: all.cost,
    avgKml,
    avgCostPerKm: all.km ? all.cost / all.km : 0,
    avgPricePerLiter: all.liters ? all.cost / all.liters : 0,
    avgFill: all.count ? all.cost / all.count : 0,
    avgKmPerFill: all.count ? all.km / all.count : 0,
    last,
    lastVsAvg: last && avgKml ? (last.kml - avgKml) / avgKml : null,
    priceVsPrev: last && prev ? (last.pricePerLiter - prev.pricePerLiter) / prev.pricePerLiter : null,
    thisMonth,
    lastMonth,
    monthlyPace,
    monthlyKmPace,
    avgDaysBetween,
    cityKml: city.liters ? city.km / city.liters : null,
    tripKml: trip.liters ? trip.km / trip.liters : null,
    cityCount: city.count,
    tripCount: trip.count,
    bestKml: best,
    worstKml: worst,
    minKml: kmls.length ? Math.min(...kmls) : 0,
    maxKml: kmls.length ? Math.max(...kmls) : 0,
    months,
    stations,
    trips,
  };
}

/** Stations used before, most used first — feeds the dropdown. */
export function knownStations(list: Fillup[]): string[] {
  const groups = new Map<string, { n: number; last: string; spell: Map<string, number> }>();
  for (const f of list) {
    const name = f.station?.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const g = groups.get(k) || { n: 0, last: "", spell: new Map<string, number>() };
    g.n += 1;
    if (f.filled_on > g.last) g.last = f.filled_on;
    g.spell.set(name, (g.spell.get(name) || 0) + 1);
    groups.set(k, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1))
    .map((g) => [...g.spell.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}

export function knownPlaces(list: Fillup[]): string[] {
  const s = new Set<string>();
  for (const f of [...list].reverse()) if (f.trip_place) s.add(f.trip_place);
  return [...s];
}
