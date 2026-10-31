"use client";

import { useState } from "react";
import { Fuel, Loader2 } from "lucide-react";
import { api, setKey } from "@/lib/api";

export default function KeyGate({ onOk }: { onOk: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.checkKey(value.trim());
      setKey(value.trim());
      onOk();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não entrou");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent text-accent-ink grid place-items-center"><Fuel size={22} /></div>
          <div>
            <h1 className="text-xl font-extrabold">Gas Track</h1>
            <p className="text-sm text-muted">Digite a senha do app (só uma vez).</p>
          </div>
        </div>
        <input className="field" type="password" autoComplete="current-password" autoCapitalize="none"
          placeholder="Senha do app" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        {error && <p className="text-bad text-sm font-semibold">{error}</p>}
        <button disabled={busy || !value.trim()}
          className="w-full rounded-xl py-3.5 font-bold bg-accent text-accent-ink disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 size={18} className="animate-spin" />} Entrar
        </button>
      </form>
    </main>
  );
}
