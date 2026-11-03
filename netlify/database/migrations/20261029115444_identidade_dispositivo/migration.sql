ALTER TABLE "apontamentos" ADD COLUMN IF NOT EXISTS "dispositivo" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Preserva a unicidade e o histórico antigo: cada pessoa vira um dispositivo legado
UPDATE "apontamentos" SET "dispositivo" = 'legacy:' || "pessoa" WHERE "dispositivo" = '';--> statement-breakpoint
DROP INDEX IF EXISTS "apontamentos_pessoa_data_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apontamentos_dispositivo_data_idx" ON "apontamentos" ("dispositivo","data");