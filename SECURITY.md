# Segurança do OS Datta

## Identificador não é credencial
`wrangler.toml` contém IDs públicos de D1. Eles identificam o binding, mas não concedem acesso ao banco. Não foram trocados. O risco efetivo era o POST sem autenticação, além de interpolação de dados locais no HTML. Configuração pública não deve conter ADMIN_KEY, DEVICE_TOKEN_SECRET, tokens Cloudflare ou credenciais de banco.

## Ativação controlada — Preview primeiro
Esta entrega é exclusivamente local. O operador autorizou publicação e criação de segredos somente no Preview; o orquestrador realizará essas ações após validar o pacote. Nenhum segredo real foi solicitado, lido ou configurado nesta execução.

1. Validar diff, `npm test`, `npm run check` e typecheck indicado no handoff.
2. Conferir o binding `DB` do **Preview** e seu schema com `periodos_ociosos`. Produção não é Preview: a divergência de schema relatada pelo orquestrador permanece fora deste escopo. Não aplicar migrations de produção.
3. No painel autorizado do Cloudflare Pages, ambiente **Preview**, definir `ADMIN_KEY` e `DEVICE_TOKEN_SECRET` como secrets. Gerar valores aleatórios independentes; DEVICE_TOKEN_SECRET deve ter pelo menos 32 bytes (recomendado: 32 bytes aleatórios codificados em hexadecimal, 64 caracteres). Nunca usar placeholders, repetir caracteres ou reutilizar os valores em produção. O servidor rejeita segredo ausente ou menor que 32 bytes; a entropia é responsabilidade da geração.
4. Publicar apenas Preview autorizado e executar smoke test nele. Não publicar produção nem apontar Preview ao DB produtivo.
5. Abrir `/conferencia.html`, autenticar com ADMIN_KEY. Solicitar ao aparelho seu UUID existente, mostrado em **Autorizar este aparelho**. Gerar credencial pelo botão do gestor. Endpoint: `POST /api/device-token`, header `x-admin-key`, JSON `{ "dispositivo": "UUID_EXISTENTE" }`. Não há autoinscrição anônima nem criação de identidade pelo servidor.
6. Transferir a credencial por canal seguro. No aparelho, colar uma vez e guardar; limpar o campo do gestor. Não usar chat público, query string, logs, screenshots de credenciais ou arquivos versionados. O app envia `Authorization: Bearer ...` somente ao endpoint same-origin `/api/apontamentos`.
7. Conferir envio de um snapshot sintético autorizado, bloqueio de outro UUID, GET sem sessão recusado e funcionamento offline. Confirmar cabeçalhos CSP e atualização do SW no navegador real, incluindo instalação já existente.

## Fronteiras e ciclo da credencial
- HMAC-SHA256/WebCrypto, versão e audiência explícitas, UUID assinado e expiração de 90 dias. A emissão requer ADMIN_KEY válida; não toca D1. O gestor deve verificar administrativamente o UUID informado: possuir um UUID não prova posse física do aparelho.
- O token autoriza somente escritas do UUID assinado. Lote misto é recusado antes de preparar SQL. Token do aparelho nunca autoriza GET administrativo. Bearer token copiado pode ser usado por quem o possuir até expirar; não há prova de posse de hardware.
- Token local fica separado em `localStorage.apt_device_token`, não em `apt`, fila, drafts, journal ou exportações. O campo é limpo após colar. Qualquer JS executado na mesma origem, extensão privilegiada ou acesso físico ao perfil pode lê-lo. Não há promessa de armazenamento criptográfico seguro no navegador. Remover a credencial local não revoga cópias.
- Falta de token não altera histórico nem orçamento da fila e não impede aprovação offline. HTTP 401/403 pausa o sincronizador sem marcar snapshots como erro permanente. Reautorizar retoma a fila existente; não refaz o consentimento nem o snapshot. Recarregar a página permite uma nova tentativa se um token antigo ainda estiver armazenado.
- Renovação: gerar novo token e colá-lo antes/após expiração. Rotação de DEVICE_TOKEN_SECRET invalida **todos** os tokens daquele ambiente; reautorizar cada aparelho. Revogação individual imediata não foi implementada (exigiria registro durável/denylist). Em incidente, rotação global é o mecanismo disponível.
- ADMIN_KEY permanece no sessionStorage da aba e no header, nunca em URL. O campo de senha é limpo na entrada e saída. Encerrar sessão remove chave da aba e limpa relatórios/credencial emitida no DOM.

## API e idempotência
Leitura JSON incremental limitada a 1 MiB, emissão limitada a 4096 bytes; Content-Type application/json obrigatório. Origens de browser diferentes da origem do request são rejeitadas. Isso não autentica clientes não-browser: a verificação criptográfica continua obrigatória. Métodos restritos, todas as respostas no-store, erros genéricos e SQL parametrizado. Erros D1 não devolvem stack/SQL. GET ainda exige ADMIN_KEY. Backend Netlify legado responde 410 sem importar banco, evitando caminho paralelo aberto; sua reativação exigirá projeto específico.

A identidade idempotente permanece `(dispositivo, data)` com UPSERT e deduplicação do lote. Perda de ACK permite reenvio do snapshot aprovado sem criar outra linha. ACK antigo não elimina snapshot novo. Isso não impede um snapshot antigo de sobrescrever outro novo recebido fora de ordem; não foi adicionado controle de versão distribuído.

## UI, CSP e cache
Valores não confiáveis escapados, recentes limitados a OS de quatro dígitos, datas validadas antes de handlers e células CSV iniciadas por operadores de fórmula neutralizadas com apóstrofo. OS numéricas válidas preservam seus bytes CSV.

Handlers inline foram substituídos por dispatcher de gramática finita e allowlist, sem eval/Function. CSP de Pages permite scripts locais e hashes dos dois módulos inline, proíbe handlers inline, objetos, frames e base. **Após editar HTML execute `node tools/security-headers.js`**; os testes verificam os hashes. CSS inline continua permitido por compatibilidade visual; isso não libera scripts inline. SW v6 não intercepta `/api/`, mantém dados API fora do cache; tokens emitidos nunca são recursos cacheáveis. Um cliente offline com SW antigo só recebe a correção quando atualizar.

## Limites residuais
Não há rate limit distribuído, WAF configurado, denylist, logs operacionais centralizados nem hardware-bound credentials. Configurar rate limit/WAF exige autorização e infraestrutura real. D1/ADMIN_KEY comprometidos, disponibilidade, extensões de navegador e validação de identidade física ficam além deste patch. `node_modules` e evidências antigas já estavam versionados na base: .gitignore evita novos arquivos, mas não remove os existentes nem reescreve histórico. A busca por padrões no snapshot atual não prova ausência absoluta de segredos, especialmente em histórico Git, arquivos binários, evidências antigas ou dependências.
