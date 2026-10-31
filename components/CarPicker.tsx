"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Car as CarIcon, Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { carLabel, cleanPlate, formatPlate, isPlate, type Car, type CarInput } from "@/lib/api";

type FormProps = {
  initial?: Car | null;
  onSave: (c: CarInput) => Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
};

/** Plate + optional nickname. */
export function CarForm({ initial, onSave, onCancel, saveLabel }: FormProps) {
  const [plate, setPlate] = useState(initial ? formatPlate(initial.plate) : "");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPlate(plate)) {
      setError("Placa inválida. Ex.: ABC1D23 ou ABC-1234");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ plate: cleanPlate(plate), nickname: nickname.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="plate">Placa</label>
          <input id="plate" className="field font-bold tracking-wider uppercase" placeholder="ABC1D23" maxLength={8}
            autoCapitalize="characters" autoComplete="off" value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())} autoFocus={!initial} />
        </div>
        <div>
          <label className="label" htmlFor="nick">Apelido (opcional)</label>
          <input id="nick" className="field" placeholder="Ex.: Onix" maxLength={40} value={nickname}
            onChange={(e) => setNickname(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-bad text-sm font-semibold">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl py-3 font-semibold bg-surface-2">Cancelar</button>
        )}
        <button disabled={busy}
          className="flex-[2] rounded-xl py-3 font-bold bg-accent text-accent-ink disabled:opacity-60 flex items-center justify-center gap-2">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {saveLabel || "Salvar carro"}
        </button>
      </div>
    </form>
  );
}

type PickerProps = {
  cars: Car[];
  selectedId: number | null;
  counts: Record<number, number>;
  onSelect: (id: number) => void;
  onCreate: (c: CarInput) => Promise<void>;
  onUpdate: (id: number, c: CarInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

/** Header button with the current plate; opens a sheet to switch, add, edit or delete cars. */
export default function CarPicker({ cars, selectedId, counts, onSelect, onCreate, onUpdate, onDelete }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "add" | { edit: Car }>("list");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = cars.find((c) => c.id === selectedId) || null;

  const close = () => {
    setOpen(false);
    setMode("list");
    setConfirm(null);
    setError(null);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-surface border border-line pl-2.5 pr-2 py-1.5 text-sm font-bold max-w-[52vw]">
        <CarIcon size={15} className="text-accent shrink-0" />
        <span className="truncate">{current ? carLabel(current) : "Escolher carro"}</span>
        <ChevronDown size={15} className="text-muted shrink-0" />
      </button>

      {/* Portal: the header uses backdrop-blur, which would trap a fixed sheet inside it. */}
      {open && createPortal(
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={close}>
          <div className="card w-full max-w-xl max-h-[88dvh] overflow-auto p-4 rounded-b-none sm:rounded-b-2xl pb-[max(env(safe-area-inset-bottom),16px)]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold">
                {mode === "list" ? "Seus carros" : mode === "add" ? "Cadastrar carro" : "Editar carro"}
              </h2>
              <button aria-label="Fechar" onClick={close} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={18} /></button>
            </div>

            {mode === "list" && (
              <div className="space-y-2">
                {cars.map((c) => (
                  <div key={c.id}
                    className={`flex items-center gap-2 rounded-xl border p-1 ${c.id === selectedId ? "border-accent bg-surface-2" : "border-line"}`}>
                    <button className="flex-1 flex items-center gap-3 text-left p-2 min-w-0"
                      onClick={() => { onSelect(c.id); close(); }}>
                      <span className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${c.id === selectedId ? "border-accent" : "border-line"}`}>
                        {c.id === selectedId && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold tracking-wider">{formatPlate(c.plate)}</span>
                        <span className="block text-xs text-muted truncate">
                          {c.nickname ? `${c.nickname} · ` : ""}{counts[c.id] || 0} abastecimento(s)
                        </span>
                      </span>
                    </button>
                    {confirm === c.id ? (
                      <div className="flex gap-1 pr-1">
                        <button className="px-3 py-1.5 rounded-lg bg-surface text-xs font-semibold border border-line"
                          onClick={() => { setConfirm(null); setError(null); }}>Não</button>
                        <button className="px-3 py-1.5 rounded-lg bg-bad text-white text-xs font-semibold"
                          onClick={async () => {
                            try { await onDelete(c.id); setConfirm(null); setError(null); }
                            catch (e) { setError(e instanceof Error ? e.message : "Não apagou"); setConfirm(null); }
                          }}>Apagar</button>
                      </div>
                    ) : (
                      <div className="flex pr-1">
                        <button aria-label="Editar carro" className="p-2 rounded-lg text-muted hover:bg-surface-2"
                          onClick={() => setMode({ edit: c })}><Pencil size={16} /></button>
                        <button aria-label="Apagar carro" className="p-2 rounded-lg text-muted hover:bg-surface-2"
                          onClick={() => setConfirm(c.id)}><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                ))}
                {error && <p className="text-bad text-sm font-semibold">{error}</p>}
                <button onClick={() => setMode("add")}
                  className="w-full rounded-xl py-3 font-bold border border-dashed border-line text-accent flex items-center justify-center gap-2">
                  <Plus size={18} /> Cadastrar novo carro
                </button>
              </div>
            )}

            {mode === "add" && (
              <CarForm onCancel={() => setMode("list")}
                onSave={async (c) => { await onCreate(c); close(); }} />
            )}

            {typeof mode === "object" && (
              <CarForm initial={mode.edit} saveLabel="Salvar alterações" onCancel={() => setMode("list")}
                onSave={async (c) => { await onUpdate(mode.edit.id, c); setMode("list"); }} />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
