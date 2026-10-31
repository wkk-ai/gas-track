"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapPin, TrendingDown, TrendingUp } from "lucide-react";
import type { Fillup } from "@/lib/api";
import { brl, dayLabel, dec, fullDate, int, summarize } from "@/lib/metrics";

function Delta({ v, goodWhenUp, label }: { v: number | null; goodWhenUp: boolean; label: string }) {
  if (v === null || !Number.isFinite(v)) return null;
  const up = v >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${good ? "text-good" : "text-bad"}`}>
      <Icon size={13} /> {up ? "+" : ""}{dec(v * 100, 1)}% {label}
    </span>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-muted">{title}</div>
      <div className="text-xl font-extrabold mt-1 leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold mb-3">{title}</h2>
      {children}
    </section>
  );
}

const axis = { fontSize: 11, fill: "var(--muted)" };
const tip = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
};

export default function Dashboard({ data }: { data: Fillup[] }) {
  const s = summarize(data);

  if (s.count === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-2">⛽</div>
        <p className="font-bold">Nenhum abastecimento ainda</p>
        <p className="text-sm text-muted mt-1">Registre o primeiro na aba Abastecer.</p>
      </div>
    );
  }

  const trend = s.rows.slice(-20).map((r) => ({ d: dayLabel(r.filled_on), kml: +r.kml.toFixed(2), preco: +r.pricePerLiter.toFixed(2) }));
  const last = s.last!;

  return (
    <div className="space-y-3">
      {/* Hero */}
      <section className="card p-5">
        <div className="text-xs font-semibold text-muted">Consumo médio</div>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-5xl font-extrabold tracking-tight">{dec(s.avgKml, 1)}</span>
          <span className="text-lg font-bold text-muted mb-1.5">km/l</span>
        </div>
        <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Último: <b>{dec(last.kml, 1)} km/l</b> <span className="text-muted">({fullDate(last.filled_on)})</span>
          </span>
          <Delta v={s.lastVsAvg} goodWhenUp label="vs média" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Stat title="Gasto este mês" value={brl(s.thisMonth.cost)}
          sub={s.lastMonth.cost ? `Mês passado ${brl(s.lastMonth.cost)}` : `${int(s.thisMonth.km)} km rodados`} />
        <Stat title="Custo por km" value={`R$ ${dec(s.avgCostPerKm, 2)}`} sub={`${int(s.totalKm)} km no total`} />
        <Stat title="Preço médio do litro" value={brl(s.avgPricePerLiter)}
          sub={<Delta v={s.priceVsPrev} goodWhenUp={false} label="último" />} />
        <Stat title="Ritmo mensal" value={brl(s.monthlyPace)} sub={`≈ ${int(s.monthlyKmPace)} km/mês (90 dias)`} />
        <Stat title="Média por tanque" value={brl(s.avgFill)} sub={`${int(s.avgKmPerFill)} km por tanque`} />
        <Stat title="Intervalo médio" value={s.avgDaysBetween !== null ? `${dec(s.avgDaysBetween, 0)} dias` : "—"}
          sub={`${s.count} abastecimentos`} />
      </div>

      {(s.cityKml !== null || s.tripKml !== null) && (
        <div className="grid grid-cols-2 gap-3">
          <Stat title="Só cidade" value={s.cityKml !== null ? `${dec(s.cityKml, 1)} km/l` : "—"} sub={`${s.cityCount} tanques`} />
          <Stat title="Com viagem" value={s.tripKml !== null ? `${dec(s.tripKml, 1)} km/l` : "—"} sub={`${s.tripCount} tanques`} />
        </div>
      )}

      {trend.length >= 2 && (
        <Section title="Consumo por abastecimento (km/l)">
          <div className="h-48 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="d" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={36} domain={["dataMin - 1", "dataMax + 1"]}
                  tickFormatter={(v: number) => dec(v, 0)} />
                <Tooltip {...tip} formatter={(v) => [`${dec(Number(v), 1)} km/l`, "Consumo"]} />
                <ReferenceLine y={s.avgKml} stroke="var(--muted)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="kml" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted mt-1">Linha tracejada = média. Melhor {dec(s.maxKml, 1)} · pior {dec(s.minKml, 1)} km/l</p>
        </Section>
      )}

      {s.months.length >= 1 && (
        <Section title="Gasto por mês">
          <div className="h-44 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.months} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => int(v)} />
                <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [brl(Number(v)), "Gasto"]} />
                <Bar dataKey="cost" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {trend.length >= 2 && (
        <Section title="Preço do litro">
          <div className="h-36 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="d" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={36} domain={["dataMin - 0.2", "dataMax + 0.2"]}
                  tickFormatter={(v: number) => dec(v, 2)} />
                <Tooltip {...tip} formatter={(v) => [brl(Number(v)), "Litro"]} />
                <Line type="monotone" dataKey="preco" stroke="var(--ink)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section title="Postos">
        <div className="divide-y divide-line">
          {s.stations.map((st) => (
            <div key={st.name} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold truncate">{st.name}</div>
                <div className="text-xs text-muted">{st.count}× · {brl(st.cost)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold">{brl(st.pricePerLiter)}/l</div>
                <div className="text-xs text-muted">{dec(st.kml, 1)} km/l</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {s.trips.length > 0 && (
        <Section title="Viagens">
          <div className="divide-y divide-line">
            {s.trips.map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold"><MapPin size={14} className="text-accent" />{t.trip_place}</span>
                <span className="text-muted text-xs">{fullDate(t.filled_on)} · {int(t.km_driven)} km · {dec(t.kml, 1)} km/l</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat title="Total gasto" value={brl(s.totalCost)} />
        <Stat title="Total km" value={int(s.totalKm)} />
        <Stat title="Total litros" value={int(s.totalLiters)} />
      </div>
    </div>
  );
}
