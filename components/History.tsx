"use client";

import { useState } from "react";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { Fillup } from "@/lib/api";
import { brl, dec, enrich, fullDate, int } from "@/lib/metrics";

type Props = {
  data: Fillup[];
  onEdit: (f: Fillup) => void;
  onDelete: (f: Fillup) => Promise<void>;
};

export default function History({ data, onEdit, onDelete }: Props) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = enrich(data).reverse();

  if (!rows.length) return <div className="card p-8 text-center text-muted">Nada registrado ainda.</div>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted font-semibold">{fullDate(r.filled_on)} · {r.fuel_type}</div>
              <div className="font-bold truncate">{r.station || "Posto não informado"}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-extrabold">{brl(r.total_cost)}</div>
              <div className="text-xs text-muted">{dec(r.liters, 2)} l · {brl(r.pricePerLiter)}/l</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span><b>{dec(r.kml, 1)}</b> <span className="text-muted">km/l</span></span>
              <span><b>{int(r.km_driven)}</b> <span className="text-muted">km</span></span>
              {r.had_trip && (
                <span className="inline-flex items-center gap-1 text-accent font-semibold">
                  <MapPin size={13} />{r.trip_place}
                </span>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {confirm === r.id ? (
                <>
                  <button className="px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-semibold" onClick={() => setConfirm(null)}>
                    Não
                  </button>
                  <button disabled={busy} className="px-3 py-1.5 rounded-lg bg-bad text-white text-xs font-semibold"
                    onClick={async () => {
                      setBusy(true);
                      try { await onDelete(r); } finally { setBusy(false); setConfirm(null); }
                    }}>
                    Apagar
                  </button>
                </>
              ) : (
                <>
                  <button aria-label="Editar" className="p-2 rounded-lg text-muted hover:bg-surface-2" onClick={() => onEdit(r)}>
                    <Pencil size={16} />
                  </button>
                  <button aria-label="Apagar" className="p-2 rounded-lg text-muted hover:bg-surface-2" onClick={() => setConfirm(r.id)}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
          {r.notes && <p className="mt-2 text-xs text-muted">{r.notes}</p>}
        </div>
      ))}
    </div>
  );
}
