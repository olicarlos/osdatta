CREATE TABLE "apontamentos" (
	"id" serial PRIMARY KEY,
	"pessoa" text NOT NULL,
	"funcao" text DEFAULT '' NOT NULL,
	"data" text NOT NULL,
	"dia" jsonb NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "apontamentos_pessoa_data_idx" ON "apontamentos" ("pessoa","data");