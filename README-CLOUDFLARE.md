# Migração para Cloudflare Pages + D1

O app continua com os mesmos arquivos estáticos em `public/`. A função em
`functions/api/apontamentos.ts` substitui a função da Netlify e mantém as rotas
`POST /api/apontamentos` e `GET /api/apontamentos?mes=YYYY-MM`. O banco novo
começa vazio; nenhum dado do banco da Netlify é necessário para esta migração.

## Preparar o D1

1. Crie um banco D1 chamado `osdatta-db` no painel da Cloudflare ou com
   `npx wrangler d1 create osdatta-db`.
2. Copie o `database_id` criado para `wrangler.toml`, substituindo
   `REPLACE_WITH_D1_DATABASE_ID`.
3. Aplique o esquema: `npx wrangler d1 migrations apply osdatta-db --remote`.
   Isso executa `migrations/0001_create_apontamentos.sql` e cria uma tabela vazia.

## Publicar no Pages

1. Importe o repositório no Cloudflare Pages e mantenha o diretório de saída
   como `public`. Não há comando de build para este app estático.
2. Configure a variável de ambiente `ADMIN_KEY` como secret nas configurações
   do projeto Pages, nos ambientes Production e Preview conforme necessário.
3. Confirme que a integração Pages reconhece o binding D1 `DB` descrito em
   `wrangler.toml`. O binding precisa apontar para o mesmo `database_id` usado
   para aplicar a migration.
4. Publique. O envio do formulário usa o mesmo caminho `/api/apontamentos`.

## Observações

- O banco usa SQLite no D1. A coluna `dia` guarda JSON como texto e é validada
  como JSON pelo esquema SQL; a API converte para/de objeto JSON.
- A consulta administrativa continua protegida pelo header `x-admin-key`.
- O service worker ignora `/api/` para não armazenar respostas privadas da
  conferência no cache offline.
