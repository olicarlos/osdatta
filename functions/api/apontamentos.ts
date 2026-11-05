import {dataValida,validateDay,canonicalDay,aprovado} from './domain.js';
import type {Dia} from './domain.js';

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
  periodos_ociosos?: unknown;
}

interface StoredRow {
  dispositivo: string;
  funcao: string;
  pessoa: string;
  data: string;
  dia: string;
  periodos_ociosos: string;
  atualizado_em: string;
}

const isTexto = (value: unknown): value is string => typeof value === "string";
const isData = dataValida;

const valido = (item: Item) => item !== null && typeof item === "object" && !Array.isArray(item) &&
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
      `SELECT dispositivo, funcao, pessoa, data, dia, periodos_ociosos, atualizado_em
       FROM apontamentos
       WHERE data LIKE ?
       ORDER BY dispositivo ASC, data ASC`,
    ).bind(`${mes}-%`).all<StoredRow>();

    const rows = results.map((row) => {
      const dia = JSON.parse(row.dia), periodos = JSON.parse(row.periodos_ociosos ?? "[]");
      if (!Array.isArray(periodos)) throw new Error("Coluna de períodos inválida");
      return ({
      dispositivo: row.dispositivo,
      funcao: row.funcao,
      pessoa: row.pessoa,
      data: row.data,
      dia: {...dia, periodos_ociosos:periodos},
      periodos_ociosos:periodos,
      atualizadoEm: row.atualizado_em,
    });
    });
    return json(rows, 200, { "Cache-Control": "no-store" });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
  }

  let items: Item[];
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 1024*1024) return json({erro:"Payload excede 1 MiB"},413);
    const body: unknown = JSON.parse(text);
    items = Array.isArray(body) ? body : [body as Item];
  } catch {
    return json({ erro: "JSON inválido" }, 400);
  }

  if (!items.length || items.length > 400 || !items.every(valido)) {
    return json({ erro: "Dados inválidos" }, 400);
  }

  const normalized: Array<Item & {dia: Dia}> = [];
  for (const item of items) {
    const input = item.dia as Record<string, unknown>;
    if (item.periodos_ociosos !== undefined && input.periodos_ociosos !== undefined &&
        JSON.stringify(item.periodos_ociosos) !== JSON.stringify(input.periodos_ociosos)) {
      return json({erro:'Períodos conflitantes no payload'},400);
    }
    const raw = {...input, ...(item.periodos_ociosos !== undefined ? {periodos_ociosos:item.periodos_ociosos} : {})};
    if (raw.periodos_ociosos !== undefined && !Array.isArray(raw.periodos_ociosos)) return json({erro:'Períodos ociosos devem ser array, nunca null.'},400);
    /* O normaliza períodos para toda jornada útil sem alterar OS/horários. */
    const dia = canonicalDay(raw), errors = validateDay(dia);
    if (errors.length) return json({erro:errors.join(' ')},400);
    if (dia.sv.length && !aprovado(dia)) return json({erro:'Todas as OS exigem confirmação do snapshot antes do envio.'},400);
    normalized.push({...item,dia});
  }

  /* Se o mesmo dia vier repetido no lote, vale o último. */
  const uniqueItems = new Map(normalized.map((item) => [
    `${(item.dispositivo as string).trim()}|${item.data}`,
    item,
  ]));

  const statements = [...uniqueItems.values()].map((item) => env.DB.prepare(
    `INSERT INTO apontamentos (dispositivo, pessoa, funcao, data, dia, periodos_ociosos)
         VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(dispositivo, data) DO UPDATE SET
       funcao = excluded.funcao,
       pessoa = COALESCE(NULLIF(excluded.pessoa, ''), apontamentos.pessoa),
       dia = excluded.dia,
       periodos_ociosos = excluded.periodos_ociosos,
       atualizado_em = CURRENT_TIMESTAMP`,
  ).bind(
    (item.dispositivo as string).trim(),
    isTexto(item.pessoa) ? item.pessoa.trim().slice(0, 80) : "",
    isTexto(item.funcao) ? item.funcao.slice(0, 40) : "",
    item.data as string,
    JSON.stringify(item.dia),
    JSON.stringify(item.dia.periodos_ociosos),
  ));

  await env.DB.batch(statements);
  return json({ ok: true, gravados: statements.length });
}
