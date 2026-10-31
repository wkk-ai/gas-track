"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import type { Fillup, FillupInput, FuelType } from "@/lib/api";
import { brl, dec, knownPlaces, knownStations, localISO, parseNum } from "@/lib/metrics";
import Combobox from "./Combobox";

const FUELS: { v: FuelType; label: string }[] = [
  { v: "gasolina", label: "Gasolina" },
  { v: "etanol", label: "Etanol" },
  { v: "diesel", label: "Diesel" },
  { v: "gnv", label: "GNV" },
];

type Props = {
  all: Fillup[];
  initial?: Fillup | null;
  onSave: (f: FillupInput) => Promise<void>;
  onCancel?: () => void;
};

const toText = (n: number | undefined, d: number) => (n === undefined ? "" : n.toFixed(d).replace(".", ","));

export default function FillForm({ all, initial, onSave, onCancel }: Props) {
  const lastUsed = all[all.length - 1];
  const [date, setDate] = useState(initial?.filled_on ?? localISO());
  const [cost, setCost] = useState(toText(initial?.total_cost, 2));
  const [liters, setLiters] = useState(toText(initial?.liters, 2));
  const [km, setKm] = useState(toText(initial?.km_driven, 1));
  const [fuel, setFuel] = useState<FuelType>(initial?.fuel_type ?? lastUsed?.fuel_type ?? "gasolina");
  const [station, setStation] = useState(initial?.station ?? "");
  const [trip, setTrip] = useState(initial?.had_trip ?? false);
  const [place, setPlace] = useState(initial?.trip_place ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stations = useMemo(() => knownStations(all), [all]);
  const places = useMemo(() => knownPlaces(all), [all]);

  const c = parseNum(cost);
  const l = parseNum(liters);
  const k = parseNum(km);
  const ok = c > 0 && l > 0 && k > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) {
      setError("Preencha valor, litros e km rodados.");
      return;
    }
    if (trip && !place.trim()) {
      setError("Diga o local da viagem.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        filled_on: date,
        total_cost: Math.round(c * 100) / 100,
        liters: Math.round(l * 1000) / 1000,
        km_driven: Math.round(k * 10) / 10,
        fuel_type: fuel,
        station: station.trim() || null,
        had_trip: trip,
        trip_place: trip ? place.trim() : null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="cost">Valor pago (R$)</label>
          <input id="cost" className="field text-lg font-bold" inputMode="decimal" placeholder="250,00"
            value={cost} onChange={(e) => setCost(e.target.value)} autoFocus={!initial} />
        </div>
        <div>
          <label className="label" htmlFor="liters">Litros</label>
          <input id="liters" className="field text-lg font-bold" inputMode="decimal" placeholder="42,5"
            value={liters} onChange={(e) => setLiters(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="km">Km rodados desde o último abastecimento</label>
        <input id="km" className="field text-lg font-bold" inputMode="decimal" placeholder="480"
          value={km} onChange={(e) => setKm(e.target.value)} />
      </div>

      {/* Live preview */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { t: "km/l", v: ok ? dec(k / l, 1) : "—" },
          { t: "R$/litro", v: c > 0 && l > 0 ? dec(c / l, 2) : "—" },
          { t: "R$/km", v: ok ? dec(c / k, 2) : "—" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl bg-surface-2 py-2.5">
            <div className="text-lg font-extrabold">{x.v}</div>
            <div className="text-[11px] text-muted font-semibold">{x.t}</div>
          </div>
        ))}
      </div>

      <div>
        <span className="label">Combustível</span>
        <div className="grid grid-cols-4 gap-2">
          {FUELS.map((f) => (
            <button key={f.v} type="button" onClick={() => setFuel(f.v)}
              className={`rounded-xl py-2.5 text-sm font-semibold border transition ${
                fuel === f.v ? "bg-ink text-bg border-ink" : "bg-surface-2 border-transparent text-muted"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="station">Posto</label>
        <Combobox id="station" value={station} onChange={setStation} options={stations}
          placeholder={stations.length ? "Escolha ou digite" : "Ex.: Shell Av. Ibirapuera"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="date">Data</label>
          <input id="date" type="date" className="field" value={date} max={localISO()}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <span className="label">Teve viagem?</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            {[false, true].map((v) => (
              <button key={String(v)} type="button" onClick={() => setTrip(v)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  trip === v ? "bg-surface shadow-sm text-ink" : "text-muted"}`}>
                {v ? "Sim" : "Não"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {trip && (
        <div>
          <label className="label flex items-center gap-1" htmlFor="place"><MapPin size={12} /> Para onde?</label>
          <Combobox id="place" value={place} onChange={setPlace} options={places} placeholder="Ex.: Santos" />
        </div>
      )}

      <div>
        <label className="label" htmlFor="notes">Observação (opcional)</label>
        <input id="notes" className="field" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: pneu calibrado" />
      </div>

      {error && <p className="text-bad text-sm font-semibold">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl py-3.5 font-semibold bg-surface-2">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={busy}
          className="flex-[2] rounded-xl py-3.5 font-bold bg-accent text-accent-ink disabled:opacity-60 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
          {initial ? "Salvar alterações" : ok ? `Salvar ${brl(c)}` : "Salvar abastecimento"}
        </button>
      </div>
    </form>
  );
}
