// Gas Track API — runs as a Neon Function next to the database.
// DATABASE_URL is injected by Neon. APP_KEY is the app password (set at deploy).
import { timingSafeEqual } from "node:crypto";

// Tiny SQL client over Neon's HTTP endpoint (no driver needed, keeps the bundle small).
type Row = Record<string, unknown>;
const pool = {
  async query(sql: string, params: unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
    const conn = process.env.DATABASE_URL || "";
    const host = new URL(conn).hostname;
    const res = await fetch(`https://${host}/sql`, {
      method: "POST",
      headers: { "content-type": "application/json", "Neon-Connection-String": conn },
      body: JSON.stringify({ query: sql, params }),
    });
    const data = (await res.json()) as { rows?: Row[]; rowCount?: number; message?: string };
    if (!res.ok) throw new Error(data.message || `SQL HTTP ${res.status}`);
    return { rows: data.rows || [], rowCount: data.rowCount ?? 0 };
  },
};

const ALLOWED_ORIGINS = [
  "https://wkk-ai.github.io",
  "http://localhost:3000",
];

const FUEL_TYPES = ["gasolina", "etanol", "diesel", "gnv"];

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-app-key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors(origin) },
  });
}

function keyOk(given: string | null): boolean {
  const expected = process.env.APP_KEY || "";
  if (!expected || !given) return false;
  const a = Buffer.from(given.trim().toLowerCase());
  const b = Buffer.from(expected.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

type Input = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function text(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}

// Returns clean values or an error message in Portuguese.
function validate(body: Input) {
  const km = num(body.km_driven);
  const liters = num(body.liters);
  const cost = num(body.total_cost);
  if (!km || km <= 0 || km > 5000) return { error: "Km rodados inválido" };
  if (!liters || liters <= 0 || liters > 300) return { error: "Litros inválido" };
  if (!cost || cost <= 0 || cost > 10000) return { error: "Valor pago inválido" };
  const date = typeof body.filled_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.filled_on)
    ? body.filled_on
    : new Date().toISOString().slice(0, 10);
  const fuel = typeof body.fuel_type === "string" && FUEL_TYPES.includes(body.fuel_type)
    ? body.fuel_type
    : "gasolina";
  const hadTrip = body.had_trip === true;
  const carId = num(body.car_id);
  if (!carId || !Number.isInteger(carId)) return { error: "Escolha o carro" };
  return {
    values: [
      date,
      km,
      liters,
      cost,
      fuel,
      text(body.station),
      hadTrip,
      hadTrip ? text(body.trip_place) : null,
      text(body.notes, 500),
      carId,
    ],
  };
}

// Brazilian plate: old ABC1234 or Mercosul ABC1D23. Stored upper-case, no hyphen.
function cleanPlate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const p = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) ? p : null;
}

const CAR_COLS = "id::int AS id, plate, nickname";

const COLS = "id::int AS id, car_id::int AS car_id, to_char(filled_on,'YYYY-MM-DD') AS filled_on, km_driven::float8 AS km_driven, liters::float8 AS liters, total_cost::float8 AS total_cost, fuel_type, station, had_trip, trip_place, notes";

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/health") return json({ ok: true, app: "gas-track" }, 200, origin);

  if (!keyOk(request.headers.get("x-app-key"))) return json({ error: "Senha do app incorreta" }, 401, origin);

  try {
    if (path === "/auth" && request.method === "GET") return json({ ok: true }, 200, origin);

    if (path === "/cars" && request.method === "GET") {
      const { rows } = await pool.query(`SELECT ${CAR_COLS} FROM cars ORDER BY created_at ASC, id ASC`);
      return json(rows, 200, origin);
    }

    if (path === "/cars" && request.method === "POST") {
      const body = (await request.json()) as Input;
      const plate = cleanPlate(body.plate);
      if (!plate) return json({ error: "Placa inválida (ex.: ABC1D23 ou ABC-1234)" }, 400, origin);
      const { rows } = await pool.query(
        `INSERT INTO cars (plate, nickname) VALUES ($1,$2) ON CONFLICT (plate) DO NOTHING RETURNING ${CAR_COLS}`,
        [plate, text(body.nickname, 40)],
      );
      if (!rows[0]) return json({ error: "Essa placa já está cadastrada" }, 409, origin);
      return json(rows[0], 201, origin);
    }

    const cm = path.match(/^\/cars\/(\d+)$/);
    if (cm && request.method === "PUT") {
      const body = (await request.json()) as Input;
      const plate = cleanPlate(body.plate);
      if (!plate) return json({ error: "Placa inválida (ex.: ABC1D23 ou ABC-1234)" }, 400, origin);
      const dup = await pool.query("SELECT 1 FROM cars WHERE plate=$1 AND id<>$2", [plate, Number(cm[1])]);
      if (dup.rows.length) return json({ error: "Essa placa já está cadastrada" }, 409, origin);
      const { rows } = await pool.query(
        `UPDATE cars SET plate=$1, nickname=$2 WHERE id=$3 RETURNING ${CAR_COLS}`,
        [plate, text(body.nickname, 40), Number(cm[1])],
      );
      if (!rows[0]) return json({ error: "Carro não encontrado" }, 404, origin);
      return json(rows[0], 200, origin);
    }

    if (cm && request.method === "DELETE") {
      const used = await pool.query("SELECT count(*)::int AS n FROM fillups WHERE car_id=$1", [Number(cm[1])]);
      const n = Number(used.rows[0]?.n || 0);
      if (n > 0) return json({ error: `Esse carro tem ${n} abastecimento(s). Apague-os antes.` }, 409, origin);
      const { rowCount } = await pool.query("DELETE FROM cars WHERE id=$1", [Number(cm[1])]);
      if (!rowCount) return json({ error: "Carro não encontrado" }, 404, origin);
      return json({ ok: true }, 200, origin);
    }

    if (path === "/fillups" && request.method === "GET") {
      const { rows } = await pool.query(`SELECT ${COLS} FROM fillups ORDER BY filled_on ASC, id ASC`);
      return json(rows, 200, origin);
    }

    if (path === "/fillups" && request.method === "POST") {
      const v = validate((await request.json()) as Input);
      if ("error" in v) return json({ error: v.error }, 400, origin);
      const { rows } = await pool.query(
        `INSERT INTO fillups (filled_on, km_driven, liters, total_cost, fuel_type, station, had_trip, trip_place, notes, car_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${COLS}`,
        v.values,
      );
      return json(rows[0], 201, origin);
    }

    const m = path.match(/^\/fillups\/(\d+)$/);
    if (m && request.method === "PUT") {
      const v = validate((await request.json()) as Input);
      if ("error" in v) return json({ error: v.error }, 400, origin);
      const { rows } = await pool.query(
        `UPDATE fillups SET filled_on=$1, km_driven=$2, liters=$3, total_cost=$4, fuel_type=$5, station=$6,
           had_trip=$7, trip_place=$8, notes=$9, car_id=$10, updated_at=now() WHERE id=$11 RETURNING ${COLS}`,
        [...v.values, Number(m[1])],
      );
      if (!rows[0]) return json({ error: "Não encontrado" }, 404, origin);
      return json(rows[0], 200, origin);
    }

    if (m && request.method === "DELETE") {
      const { rowCount } = await pool.query("DELETE FROM fillups WHERE id=$1", [Number(m[1])]);
      if (!rowCount) return json({ error: "Não encontrado" }, 404, origin);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Rota não existe" }, 404, origin);
  } catch (err) {
    console.error(err);
    if (String(err).includes("foreign key")) return json({ error: "Carro não encontrado" }, 400, origin);
    return json({ error: "Erro no servidor" }, 500, origin);
  }
}
