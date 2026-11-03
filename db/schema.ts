import { pgTable, serial, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/* Um registro por dispositivo e por dia, com o conteúdo do dia como foi lançado no app.
   A coluna "pessoa" é mantida apenas para histórico (registros legados). */
export const apontamentos = pgTable(
  "apontamentos",
  {
    id: serial().primaryKey(),
    dispositivo: text().notNull().default(""),
    pessoa: text().notNull(),
    funcao: text().notNull().default(""),
    data: text().notNull(),
    dia: jsonb().notNull(),
    atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("apontamentos_dispositivo_data_idx").on(t.dispositivo, t.data)],
);
