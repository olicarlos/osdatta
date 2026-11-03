interface D1Result<T> {
  results: T[];
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

interface Env {
  DB: D1Database;
  ADMIN_KEY?: string;
}

interface Item {
  dispositivo?: unknown;
  pessoa?: unknown;
  funcao?: unknown;
  data?: unknown;
  dia?: unknown;
}

interface StoredRow {
  dispositivo: string;
  funcao: string;
  pessoa: string;
  data: string;
  dia: string;
  atualizado_em: string;
}

const isTexto = (value: unknown): value is string => typeof value === "string";
const isData = (value: unknown) => isTexto(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

const valido = (item: Item) =>
  isTexto(item.dispositivo) && item.dispositivo.trim().length >= 1 && item.dispositivo.trim().length <= 64 &&
  isData(item.data) &&
  item.dia !== null && typeof item.dia === "object" && !Array.isArray(item.dia);

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers });

/* Recebe os dias lançados no celular e grava (ou atualiza) no D1.
   GET ?mes=YYYY-MM atende à conferência do gestor (protegida por x-admin-key). */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const expected = env.ADMIN_KEY || "";
    const key = request.headers.get("x-admin-key") || "";
    if (!expected || key !== expected) {
      return json({ erro: "Não autorizado" }, 401, { "Cache-Control": "no-store" });
    }

    const mes = url.searchParams.get("mes") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return json({ erro: "Parâmetro 'mes' inválido (use YYYY-MM)" }, 400);
    }

    const { results } = await env.DB.prepare(
      `SELECT dispositivo, funcao, pessoa, data, dia, atualizado_em
       FROM apontamentos
       WHERE data LIKE ?
       ORDER BY dispositivo ASC, data ASC`,
    ).bind(`${mes}-%`).all<StoredRow>();

    const rows = results.map((row) => ({
      dispositivo: row.dispositivo,
      funcao: row.funcao,
      pessoa: row.pessoa,
      data: row.data,
      dia: JSON.parse(row.dia),
      atualizadoEm: row.atualizado_em,
    }));
    return json(rows, 200, { "Cache-Control": "no-store" });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
  }

  let items: Item[];
  try {
    const body: unknown = await request.json();
    items = Array.isArray(body) ? body : [body as Item];
  } catch {
    return json({ erro: "JSON inválido" }, 400);
  }

  if (!items.length || items.length > 400 || !items.every(valido)) {
    return json({ erro: "Dados inválidos" }, 400);
  }

  /* Se o mesmo dia vier repetido no lote, vale o último. */
  const uniqueItems = new Map(items.map((item) => [
    `${(item.dispositivo as string).trim()}|${item.data}`,
    item,
  ]));

  const statements = [...uniqueItems.values()].map((item) => env.DB.prepare(
    `INSERT INTO apontamentos (dispositivo, pessoa, funcao, data, dia)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(dispositivo, data) DO UPDATE SET
       funcao = excluded.funcao,
       pessoa = COALESCE(NULLIF(excluded.pessoa, ''), apontamentos.pessoa),
       dia = excluded.dia,
       atualizado_em = CURRENT_TIMESTAMP`,
  ).bind(
    (item.dispositivo as string).trim(),
    isTexto(item.pessoa) ? item.pessoa.trim().slice(0, 80) : "",
    isTexto(item.funcao) ? item.funcao.slice(0, 40) : "",
    item.data as string,
    JSON.stringify(item.dia),
  ));

  await env.DB.batch(statements);
  return json({ ok: true, gravados: statements.length });
}
