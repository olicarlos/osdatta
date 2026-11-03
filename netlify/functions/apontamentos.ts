import type { Config } from "@netlify/functions";
import { asc, like, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { apontamentos } from "../../db/schema.js";

type Item = { dispositivo?: unknown; pessoa?: unknown; funcao?: unknown; data?: unknown; dia?: unknown };

const isTexto = (v: unknown) => typeof v === "string";
const isData = (v: unknown) => isTexto(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);

const valido = (x: Item) =>
  isTexto(x.dispositivo) && (x.dispositivo as string).trim().length >= 1 && (x.dispositivo as string).trim().length <= 64 &&
  isData(x.data) &&
  x.dia !== null && typeof x.dia === "object" && !Array.isArray(x.dia);

const adminKey = () => {
  const g = globalThis as any;
  return g.Netlify?.env?.get?.("ADMIN_KEY") ?? g.process?.env?.ADMIN_KEY ?? "";
};

/* Recebe os dias lançados no celular e grava (ou atualiza) no banco.
   GET ?mes=YYYY-MM atende a conferência do gestor (protegida por x-admin-key). */
export default async (req: Request) => {
  const url = new URL(req.url);

  /* ===== Leitura do gestor: GET /api/apontamentos?mes=YYYY-MM ===== */
  if (req.method === "GET") {
    const esperada = adminKey();
    const chave = req.headers.get("x-admin-key") || "";
    if (!esperada || chave !== esperada) {
      return Response.json({ erro: "Não autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const mes = url.searchParams.get("mes") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return Response.json({ erro: "Parâmetro 'mes' inválido (use YYYY-MM)" }, { status: 400 });
    }
    const linhas = await db
      .select({
        dispositivo: apontamentos.dispositivo,
        funcao: apontamentos.funcao,
        pessoa: apontamentos.pessoa,
        data: apontamentos.data,
        dia: apontamentos.dia,
        atualizadoEm: apontamentos.atualizadoEm,
      })
      .from(apontamentos)
      .where(like(apontamentos.data, `${mes}-%`))
      .orderBy(asc(apontamentos.dispositivo), asc(apontamentos.data));
    return Response.json(linhas, { headers: { "Cache-Control": "no-store" } });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let itens: Item[];
  try {
    const body = await req.json();
    itens = Array.isArray(body) ? body : [body];
  } catch {
    return Response.json({ erro: "JSON inválido" }, { status: 400 });
  }
  if (!itens.length || itens.length > 400 || !itens.every(valido)) {
    return Response.json({ erro: "Dados inválidos" }, { status: 400 });
  }
  /* Se o mesmo dia vier repetido no lote, vale o último */
  const unicos = new Map(itens.map((x) => [(x.dispositivo as string).trim() + "|" + x.data, x]));
  const linhas = [...unicos.values()].map((x) => ({
    dispositivo: (x.dispositivo as string).trim(),
    pessoa: isTexto(x.pessoa) ? (x.pessoa as string).trim().slice(0, 80) : "",
    funcao: isTexto(x.funcao) ? (x.funcao as string).slice(0, 40) : "",
    data: x.data as string,
    dia: x.dia as object,
  }));
  await db
    .insert(apontamentos)
    .values(linhas)
    .onConflictDoUpdate({
      target: [apontamentos.dispositivo, apontamentos.data],
      set: {
        funcao: sql`excluded.funcao`,
        /* mantém o nome legado já gravado quando o app novo não envia pessoa */
        pessoa: sql`coalesce(nullif(excluded.pessoa, ''), ${apontamentos.pessoa})`,
        dia: sql`excluded.dia`,
        atualizadoEm: sql`now()`,
      },
    });
  return Response.json({ ok: true, gravados: linhas.length });
};

export const config: Config = { path: "/api/apontamentos" };
