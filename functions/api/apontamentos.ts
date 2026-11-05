import {json,boundary,adminOK,configured,authorize,readJSON,BodyError} from '../../server/security.ts';
import {dataValida,validateDay,canonicalDay,aprovado} from '../../public/domain.js';
import type {Dia} from '../../public/domain.js';

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
  DEVICE_TOKEN_SECRET?: string;
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

/* Recebe os dias lançados no celular e grava (ou atualiza) no D1.
   GET ?mes=YYYY-MM atende à conferência do gestor (protegida por x-admin-key). */
async function handle(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const rejected = boundary(request,["GET","POST"]); if (rejected) return rejected;

  if (request.method === "GET") {
    if (!adminOK(request,env)) {
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

  if (!configured(env)) return json({erro:'Autorização indisponível'},503);
  const device = await authorize(request,env);
  if (!device) return json({erro:'Não autorizado'},401);
  const body = await readJSON(request);
  const items: Item[] = Array.isArray(body) ? body : [body as Item];
  if (items.some(item => item && typeof item === 'object' && item.dispositivo !== device)) return json({erro:'Aparelho não autorizado'},403);

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

export async function onRequest(context: {request: Request; env: Env}): Promise<Response> {
  try { return await handle(context); }
  catch (error) { return json({erro:error instanceof BodyError ? 'Requisição inválida' : 'Serviço indisponível'},error instanceof BodyError ? error.status : 503); }
}
