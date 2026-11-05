# Handoff — hardening local OS Datta

**Dono da implementação:** agency-automation-engineer. **Próximo dono:** agency-orchestrator, para aceite e publicação somente no Preview autorizado. Produção, remoto, bancos e segredos não foram alterados.

## Contrato e decisões
Fonte de requisitos: card `t_f96afe8d`, base `ee78912cf413898d0e617a7cf3c0eba1685decba`, branch `revisao/seguranca-api-20261105`. O card já especificou desenho HMAC por aparelho, UI offline e critérios; esta execução implementou esse contrato, sem criar nova iniciativa ou alterar regras de alocação. Vanilla JS/PWA, jornada 528, pesos 1/2/3, tipos T/A/F/O, almoço, ociosidades múltiplas, confirmação completa, identidade e snapshot/journal/fila existentes preservados. Idempotência continua por dispositivo/data; não foi introduzido login nominal.

## Achados e correções verificáveis
- **POST aberto**, base `functions/api/apontamentos.ts:95-153`: escrevia sem autenticação. Agora `functions/api/apontamentos.ts:94-98` exige token e rejeita aparelho alheio/lote misto antes do D1. Emissão administrativa em `functions/api/device-token.ts:6-12`.
- **Limite posterior à leitura**, base `functions/api/apontamentos.ts:101-102`: acumulava todo o body. `server/security.ts:39-57` faz leitura incremental limitada e cancela stream excedente. Erros D1 tratados em `functions/api/apontamentos.ts:150`; respostas API no-store pelo helper comum.
- **Injeção por horário local**, base `public/index.html:192`: atributo não escapado. Escapado na mesma linha. Alertas e peso da revisão também escapados. Datas do gestor escapadas em `public/conferencia.html:209`. Recentes são filtrados por quatro dígitos, evitando strings executáveis em ações.
- **CSV formula injection**, base `public/index.html:385`: apenas aspas CSV. Neutralização em `public/index.html:393`, preservando OS numéricas válidas.
- **Senha residual no DOM**, base `public/conferencia.html:99-103`: agora campo limpo ao entrar (`:101`), sair (`:89`) e voltar ao login. Logout limpa relatórios e credencial emitida.
- **Handlers inline/CSP ausente**: dispatcher com allowlist em `public/index.html:422`; `_headers` usa hashes reais e `script-src-attr 'none'`, sem unsafe-eval. Atualizar hashes com `node tools/security-headers.js`. LF fixado em `.gitattributes` para estabilidade.
- **Backend alternativo Netlify aberto**, base `netlify/functions/apontamentos.ts:52-86`: desativado com HTTP 410, sem tocar DB. Backend suportado nesta entrega é Pages/D1.
- **Fila sem autorização**: `public/index.html:335-369` guarda credencial separada, não gasta orçamento sem token/401/403 e conserva snapshots. SW v6 mantém `/api/` fora do cache (`public/sw.js:22`).

## Auditoria de credenciais
Busca por padrões no snapshot de fontes versionadas: `security-audit.json`. Dois matches revisados: `tests/preview-server.js:16` (fixture sintética administrativa de ensaio) e `tests/regression.test.js:41` (fixture sintética). As referências são do snapshot no momento da busca; o servidor local foi posteriormente adaptado. Nenhum valor real foi copiado. IDs D1 não são credenciais. A busca excluiu node_modules, evidências antigas/binárias e histórico Git; não constitui prova de inexistência absoluta de segredo. Dependências/evidências já versionadas não foram removidas ou reescritas.

## Validação executada
Node v24.15.0, TypeScript 5.9.3. `npm test`: **59 testes, 59 passaram, zero falhas**. `npm run check`: exit 0. Compilador real também executado separadamente, exit 0:

```sh
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions --strict --target es2022 --module es2022 --moduleResolution bundler --skipLibCheck --lib es2022,dom functions/api/apontamentos.ts functions/api/device-token.ts netlify/functions/apontamentos.ts
```

Testes importam handlers TS reais pelo suporte nativo do Node 24; D1 é mock explícito e SQLite `:memory:`. Assertions cobrem zero acessos em falhas auth/origem/parsing, assinatura adulterada/expirada, segredo ausente/fraco, lote misto, limite streaming e cancelamento, exceções SQL sem vazamento, métodos, GET isolado, emissão real → colar no app real → aprovação offline → D1 mock. Cobrem fila/histórico intactos sem token, export sem token, dispatcher, strings adversariais e idempotência após perda de ACK. Testes antigos receberam apenas credenciais sintéticas para alcançar a mesma validação de negócio; asserts de negócio foram preservados.

Métricas `pygount` 3.2.0 executadas em venv `.audit-venv` isolado, excluindo dependências/evidências. Nenhuma dependência npm foi atualizada. Logs completos ficam no pacote. **Não foi executado navegador real nesta fase**: aceite visual, CSP efetivo/console e instalação PWA existente pertencem ao orquestrador, conforme card.

## Reprodução e próxima ação
1. Validar commit/diff/manifesto e CRC do ZIP; o pacote inclui fontes alteradas, todos os scripts de teste, patch da base e logs reais. O ZIP não é clone completo: aplicar patch sobre a base ou usar este workspace. `SHA256SUMS` cobre arquivos entregues, exceto o próprio manifesto; metadados do ZIP são externos para evitar hash circular.
2. Executar `npm test` e `npm run check` no workspace. `npm run preview:local` sobe somente `127.0.0.1:8789`, SQLite em memória. A chave documentada no código é **sintética e exclusivamente local**; nunca usar em ambiente. O ensaio suporta os dois endpoints e serve o CSP real.
3. Validar no navegador: selecionar função, preencher OS, revisar/confirmar offline, autorizar com UUID existente, enviar snapshot e verificar conferência/saída, CSV e atualização SW.
4. Para Preview, criar secrets **ADMIN_KEY** e **DEVICE_TOKEN_SECRET**, binding **DB** separado. Endpoint **POST /api/device-token**, header **x-admin-key**, JSON **dispositivo**. Retorna **token** e **expiresAt**. Ativação detalhada em `SECURITY.md`.
5. Publicar apenas Preview após aceite. Não aplicar migration, trocar segredo ou publicar produção nesta etapa.

## Riscos residuais
Bearer token copiável, localStorage acessível a JS/extension/perfil, validade 90 dias, revogação somente por rotação global do segredo. Sem denylist individual, rate limit/WAF distribuído ou ordenação/versionamento de writes entre snapshots antigos/novos. ADMIN_KEY permanece em sessionStorage da aba por decisão existente. CSS inline permitido; scripts/handlers inline não. PWA offline antiga precisa atualizar. Divergência de schema produtivo não corrigida. Não houve push, deploy ou acesso Cloudflare.
