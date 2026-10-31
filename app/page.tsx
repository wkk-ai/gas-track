"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Car as CarIcon, Fuel, List, LogOut, Loader2, RefreshCw } from "lucide-react";
import { api, ApiError, carLabel, getKey, setKey, type Car, type CarInput, type Fillup, type FillupInput } from "@/lib/api";
import { dec } from "@/lib/metrics";
import FillForm from "@/components/FillForm";
import Dashboard from "@/components/Dashboard";
import History from "@/components/History";
import KeyGate from "@/components/KeyGate";
import CarPicker, { CarForm } from "@/components/CarPicker";

type Tab = "add" | "dash" | "list";
const CACHE = "gas-track-cache-v2";
const CAR_KEY = "gas-track-car";

type Cache = { cars: Car[]; fillups: Fillup[] };

function readCache(): Cache {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "{}");
    return { cars: c.cars || [], fillups: c.fillups || [] };
  } catch {
    return { cars: [], fillups: [] };
  }
}
function writeCache(c: Cache) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}
function readCar(): number | null {
  try {
    const v = Number(localStorage.getItem(CAR_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
function writeCar(id: number | null) {
  try {
    if (id) localStorage.setItem(CAR_KEY, String(id));
    else localStorage.removeItem(CAR_KEY);
  } catch {
    /* ignore */
  }
}

const byDate = (a: Fillup, b: Fillup) => (a.filled_on === b.filled_on ? a.id - b.id : a.filled_on < b.filled_on ? -1 : 1);

export default function Home() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("add");
  const [cars, setCars] = useState<Car[]>([]);
  const [data, setData] = useState<Fillup[]>([]);
  const [carId, setCarId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Fillup | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const save = (nextCars: Car[], nextData: Fillup[]) => {
    setCars(nextCars);
    setData(nextData);
    writeCache({ cars: nextCars, fillups: nextData });
  };

  const pickCar = useCallback((id: number | null) => {
    setCarId(id);
    writeCar(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, d] = await Promise.all([api.cars(), api.list()]);
      setCars(c);
      setData(d);
      writeCache({ cars: c, fillups: d });
      setCarId((cur) => {
        const keep = cur && c.some((x) => x.id === cur) ? cur : c[0]?.id ?? null;
        writeCar(keep);
        return keep;
      });
      setLoaded(true);
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
    if (has) {
      const c = readCache();
      setCars(c.cars);
      setData(c.fillups);
      const saved = readCar();
      setCarId(saved && c.cars.some((x) => x.id === saved) ? saved : c.cars[0]?.id ?? null);
      if (c.cars.length) setLoaded(true);
    }
    setReady(true);
  }, []);

  // Auto-update: the iPhone keeps the home-screen app in memory, so check for a new version
  // when the app opens or comes back to the front, and reload if there is one.
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine || mine === "dev") return;
    const check = async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/version.json?t=${Date.now()}`, { cache: "no-store" });
        const { v } = await r.json();
        if (!v || v === mine) return;
        // Only one try per new version, so a stale cache can never cause a reload loop.
        const tried = sessionStorage.getItem("gas-track-update");
        if (tried === v) return;
        sessionStorage.setItem("gas-track-update", v);
        const url = new URL(window.location.href);
        url.searchParams.set("v", v.slice(0, 7)); // new address skips the cached page
        window.location.replace(url.toString());
      } catch {
        /* offline: keep current version */
      }
    };
    check();
    const onShow = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const all = useMemo(() => [...data].sort(byDate), [data]);
  const mine = useMemo(() => all.filter((f) => f.car_id === carId), [all, carId]);
  const counts = useMemo(() => {
    const m: Record<number, number> = {};
    for (const f of data) m[f.car_id] = (m[f.car_id] || 0) + 1;
    return m;
  }, [data]);

  if (!ready) return null;
  if (!authed) return <KeyGate onOk={() => setAuthed(true)} />;

  const current = cars.find((c) => c.id === carId) || null;

  async function create(f: FillupInput) {
    const saved = await api.create(f);
    save(cars, [...data, saved]);
    setFormKey((k) => k + 1);
    setToast(`Salvo · ${dec(saved.km_driven / saved.liters, 1)} km/l`);
    setTab("dash");
    window.scrollTo({ top: 0 });
  }

  async function update(f: FillupInput) {
    if (!editing) return;
    const saved = await api.update(editing.id, f);
    save(cars, data.map((d) => (d.id === saved.id ? saved : d)));
    setEditing(null);
    setToast("Alterado");
  }

  async function remove(f: Fillup) {
    try {
      await api.remove(f.id);
      save(cars, data.filter((d) => d.id !== f.id));
      setToast("Apagado");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Não apagou");
    }
  }

  async function addCar(c: CarInput) {
    const saved = await api.createCar(c);
    save([...cars, saved], data);
    pickCar(saved.id);
    setFormKey((k) => k + 1);
    setToast(`Carro ${carLabel(saved)} cadastrado`);
  }

  async function editCar(id: number, c: CarInput) {
    const saved = await api.updateCar(id, c);
    save(cars.map((x) => (x.id === id ? saved : x)), data);
  }

  async function deleteCar(id: number) {
    await api.removeCar(id);
    const next = cars.filter((x) => x.id !== id);
    save(next, data);
    if (carId === id) pickCar(next[0]?.id ?? null);
    setToast("Carro apagado");
  }

  const titles: Record<Tab, string> = { add: "Abastecer", dash: "Painel", list: "Histórico" };
  const noCars = loaded && cars.length === 0;

  return (
    <div className="mx-auto max-w-xl min-h-dvh pb-28">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent text-accent-ink grid place-items-center shrink-0"><Fuel size={17} /></div>
          <h1 className={`text-lg font-extrabold truncate ${cars.length ? "hidden min-[420px]:block" : ""}`}>{titles[tab]}</h1>
        </div>
        <div className="flex items-center gap-0.5 text-muted shrink-0">
          {cars.length > 0 && (
            <CarPicker cars={cars} selectedId={carId} counts={counts} onSelect={pickCar}
              onCreate={addCar} onUpdate={editCar} onDelete={deleteCar} />
          )}
          <button aria-label="Atualizar" className="p-2 rounded-lg hover:bg-surface-2" onClick={load}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
          <button aria-label="Sair" className="p-2 rounded-lg hover:bg-surface-2"
            onClick={() => { setKey(null); setAuthed(false); save([], []); pickCar(null); setLoaded(false); }}>
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

        {!loaded && !error && (
          <div className="card p-8 grid place-items-center text-muted"><Loader2 className="animate-spin" /></div>
        )}

        {noCars && (
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-surface-2 grid place-items-center text-accent"><CarIcon size={20} /></div>
              <div>
                <h2 className="font-extrabold">Cadastre seu carro</h2>
                <p className="text-sm text-muted">Depois é só trocar pela placa no topo.</p>
              </div>
            </div>
            <CarForm onSave={addCar} saveLabel="Cadastrar carro" />
          </div>
        )}

        {loaded && current && (
          <>
            {tab === "add" && (
              <div className="card p-4">
                <FillForm key={`${formKey}-${current.id}`} carId={current.id} all={mine} everything={all} onSave={create} />
              </div>
            )}
            {tab === "dash" && <Dashboard key={current.id} data={mine} />}
            {tab === "list" && <History data={mine} onEdit={setEditing} onDelete={remove} />}
          </>
        )}
      </main>

      {editing && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-xl max-h-[92dvh] overflow-auto p-4 rounded-b-none sm:rounded-b-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="font-extrabold mb-3">Editar abastecimento</h2>
            <FillForm carId={editing.car_id} all={mine} everything={all} initial={editing} onSave={update}
              onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-ink text-bg rounded-full px-4 py-2 text-sm font-semibold shadow-lg max-w-[90vw] truncate">
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
