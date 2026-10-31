// Talks to the Gas Track API (a Neon Function next to the Neon database).
export const API_URL = "https://br-royal-sound-b8c99kph-gastrack.compute.c-14.us-east-1.aws.neon.tech";

export type FuelType = "gasolina" | "etanol" | "diesel" | "gnv";

export type Car = {
  id: number;
  plate: string; // ABC1234 or ABC1D23, no hyphen
  nickname: string | null;
};

export type CarInput = Omit<Car, "id">;

/** ABC1234 -> ABC-1234 (old style). Mercosul ABC1D23 stays as is. */
export function formatPlate(p: string): string {
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function cleanPlate(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const isPlate = (v: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(cleanPlate(v));

export const carLabel = (c: Car) => (c.nickname ? `${c.nickname} · ${formatPlate(c.plate)}` : formatPlate(c.plate));

export type Fillup = {
  id: number;
  car_id: number;
  filled_on: string; // YYYY-MM-DD
  km_driven: number;
  liters: number;
  total_cost: number;
  fuel_type: FuelType;
  station: string | null;
  had_trip: boolean;
  trip_place: string | null;
  notes: string | null;
};

export type FillupInput = Omit<Fillup, "id">;

const KEY_STORAGE = "gas-track-key";

export function getKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* private mode: key lives only for this visit */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}, key = getKey()): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: { "content-type": "application/json", "x-app-key": key || "", ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError("Sem conexão. Tente de novo.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || "Erro inesperado", res.status);
  return data as T;
}

const clean = (f: Fillup): Fillup => ({ ...f, id: Number(f.id), car_id: Number(f.car_id) });
const cleanCar = (c: Car): Car => ({ ...c, id: Number(c.id) });

export const api = {
  checkKey: (key: string) => call<{ ok: boolean }>("/auth", {}, key),
  list: async () => (await call<Fillup[]>("/fillups")).map(clean),
  create: async (f: FillupInput) => clean(await call<Fillup>("/fillups", { method: "POST", body: JSON.stringify(f) })),
  update: async (id: number, f: FillupInput) =>
    clean(await call<Fillup>(`/fillups/${id}`, { method: "PUT", body: JSON.stringify(f) })),
  cars: async () => (await call<Car[]>("/cars")).map(cleanCar),
  createCar: async (c: CarInput) => cleanCar(await call<Car>("/cars", { method: "POST", body: JSON.stringify(c) })),
  updateCar: async (id: number, c: CarInput) =>
    cleanCar(await call<Car>(`/cars/${id}`, { method: "PUT", body: JSON.stringify(c) })),
  removeCar: (id: number) => call<{ ok: boolean }>(`/cars/${id}`, { method: "DELETE" }),
  remove: (id: number) => call<{ ok: boolean }>(`/fillups/${id}`, { method: "DELETE" }),
};
