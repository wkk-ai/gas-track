"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Fuel, List, LogOut, Loader2, RefreshCw } from "lucide-react";
import { api, ApiError, getKey, setKey, type Fillup, type FillupInput } from "@/lib/api";
import { dec } from "@/lib/metrics";
import FillForm from "@/components/FillForm";
import Dashboard from "@/components/Dashboard";
import History from "@/components/History";
import KeyGate from "@/components/KeyGate";

type Tab = "add" | "dash" | "list";
const CACHE = "gas-track-cache";

function readCache(): Fillup[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || "[]");
  } catch {
    return [];
  }
}
function writeCache(d: Fillup[]) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("add");
  const [data, setData] = useState<Fillup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Fillup | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.list();
      setData(d);
      writeCache(d);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setKey(null);
        setAuthed(false);
      } else setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const has = !!getKey();
    setAuthed(has);
    if (has) setData(readCache());
    setReady(true);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ready) return null;
  if (!authed) return <KeyGate onOk={() => setAuthed(true)} />;

  const sorted = [...data].sort((a, b) => (a.filled_on === b.filled_on ? a.id - b.id : a.filled_on < b.filled_on ? -1 : 1));

  async function create(f: FillupInput) {
    const saved = await api.create(f);
    const next = [...data, saved];
    setData(next);
    writeCache(next);
    setFormKey((k) => k + 1);
    setToast(`Salvo · ${dec(saved.km_driven / saved.liters, 1)} km/l`);
    setTab("dash");
    window.scrollTo({ top: 0 });
  }

  async function update(f: FillupInput) {
    if (!editing) return;
    const saved = await api.update(editing.id, f);
    const next = data.map((d) => (d.id === saved.id ? saved : d));
    setData(next);
    writeCache(next);
    setEditing(null);
    setToast("Alterado");
  }

  async function remove(f: Fillup) {
    try {
      await api.remove(f.id);
      const next = data.filter((d) => d.id !== f.id);
      setData(next);
      writeCache(next);
      setToast("Apagado");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Não apagou");
    }
  }

  const titles: Record<Tab, string> = { add: "Novo abastecimento", dash: "Painel", list: "Histórico" };

  return (
    <div className="mx-auto max-w-xl min-h-dvh pb-28">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent text-accent-ink grid place-items-center"><Fuel size={17} /></div>
          <h1 className="text-lg font-extrabold">{titles[tab]}</h1>
        </div>
        <div className="flex items-center gap-1 text-muted">
          <button aria-label="Atualizar" className="p-2 rounded-lg hover:bg-surface-2" onClick={load}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
          <button aria-label="Sair" className="p-2 rounded-lg hover:bg-surface-2"
            onClick={() => { setKey(null); setAuthed(false); setData([]); writeCache([]); }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="px-4">
        {error && (
          <div className="card p-3 mb-3 text-sm flex items-center justify-between gap-2">
            <span className="text-bad font-semibold">{error}</span>
            <button className="font-semibold underline" onClick={load}>Tentar de novo</button>
          </div>
        )}

        {tab === "add" && (
          <div className="card p-4">
            <FillForm key={formKey} all={sorted} onSave={create} />
          </div>
        )}
        {tab === "dash" && <Dashboard data={sorted} />}
        {tab === "list" && <History data={sorted} onEdit={setEditing} onDelete={remove} />}
      </main>

      {editing && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-xl max-h-[92dvh] overflow-auto p-4 rounded-b-none sm:rounded-b-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="font-extrabold mb-3">Editar abastecimento</h2>
            <FillForm all={sorted} initial={editing} onSave={update} onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 bg-ink text-bg rounded-full px-4 py-2 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-xl grid grid-cols-3">
          {([
            { t: "add", label: "Abastecer", Icon: Fuel },
            { t: "dash", label: "Painel", Icon: BarChart3 },
            { t: "list", label: "Histórico", Icon: List },
          ] as const).map(({ t, label, Icon }) => (
            <button key={t} onClick={() => { setTab(t); window.scrollTo({ top: 0 }); }}
              className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-semibold ${tab === t ? "text-accent" : "text-muted"}`}>
              <Icon size={22} strokeWidth={tab === t ? 2.4 : 1.8} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
