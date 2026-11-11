# OS Datta — correção local para revisão independente

## Estado e limites

A entrega anterior foi rejeitada e este documento a substitui. A implementação agora altera `public/index.html`, `public/conferencia.html` e `functions/api/apontamentos.ts`, além dos módulos compartilhados. Não houve push, deploy ou migração remota. O ambiente de teste publicado continua sob responsabilidade do orquestrador. Esta entrega não representa aceite do usuário nem liberação de produção.

Branch: `revisao/ociosidade-multiplos-periodos`. Base: `f165587dd819ff616a712817ee0ebd78e9109e1b`. `db/schema.ts` PostgreSQL foi restaurado, sem modelar D1. `0001` e arquivos Netlify/Drizzle permanecem intactos. Nenhuma dependência foi instalada. `node_modules/` preexistente e não versionado não integra a entrega.

## Contrato e fontes executadas

- `public/domain.js` e `domain.d.ts`: validação única, datas reais, cálculo e normalização. Jornada de 528 min e feriados de 2026 preservados. Bruto − almoço − ociosidade antes das categorias normais/HE50/HE100. Exemplo real testado: 588 − 60 − 45 = 483 min. Não armazena total separado.
- `public/index.html`: CRUD de períodos com início/fim HH:mm, mensagens de conflito com almoço e botões mobile. Limites adjacentes são válidos. Entrada/saída invertida, almoço inválido, período fora da jornada, overlap, campos incompletos e listas inválidas impedem confirmação.
- `aloc()` não foi alterada. O teste compara seu corpo com o commit-base e verifica somas por categoria com pesos 1/2/3 e arredondamento cumulativo.
- Tipo `O`: exige horários reais; normaliza o array para entrada→almoço e volta→saída, ou um intervalo sem almoço. Produtivo zero. A normalização de `O` substitui os períodos fornecidos por toda jornada útil. OS e horários não são apagados. Trocar tipos no rascunho é reversível e conserva os períodos manuais até confirmar. `T/A/F` continuam disponíveis.
- `functions/api/apontamentos.ts`: POST valida todo lote antes do batch e faz upsert por dispositivo/data. GET administrativo retorna `periodos_ociosos` parseado também dentro de `dia`. Coluna D1 é canônica. Se arrays no topo e em `dia` conflitam, rejeita; ausência vira `[]`; `null` não é array e é rejeitado. Máximos: 1 MiB por requisição, 400 dias, 200 OS/dia e 100 períodos/dia na validação compartilhada. Dia O é normalizado antes da validação final.
- `public/conferencia.html`: lê o campo canônico e usa mesmo cálculo. Mostra cada início/fim, ocioso total diário, bruto, almoço, descontado e produtivo. Registro inválido tem totais zerados e aviso, não minutos negativos.
- Resumo mensal e exportações usam apenas histórico salvo, nunca drafts. CSV/JSON incluem tipo O, array e totais diários. Os totais diários repetem em cada linha de OS: não somá-los por OS. As colunas de alocação continuam individuais por serviço.

## Rascunho, consentimento e sincronização

`public/workflow.js` opera os estados reais:

1. Qualquer edição é guardada em `apt_drafts`, marcada como rascunho. Não altera `apt` nem `apt_pend`. Nenhum popup ocorre por edição de horário.
2. **Salvar dia / Confirmar dia** abre uma tela acessível, com foco no título, contendo TODAS as OS completas e sufixos, inclusive duplicadas. Há três ações: **Confirmar e salvar**, **Voltar para corrigir** e **Cancelar**. Voltar e cancelar mantêm o rascunho sem alterar histórico/fila; **Descartar rascunho** é uma ação separada.
3. Confirmar grava o snapshot e lista de OS em `dia.confirmacao`. Cada edição incrementa `revisao`, incluindo remoção/desfazer e repetição. Uma revisão aberta não autoriza um draft alterado.
4. `apt_pend[chave].payload` é uma cópia aprovada completa (inclui dispositivo, função, data, dia), nunca uma referência ao draft ou à função atual. Reabrir cria draft sem mudar snapshot salvo ou pendente.
5. `apt_commit` é um journal local de aprovação: se o processo parar entre gravações de storage, o construtor termina o commit no próximo carregamento. Não existe journal antes do consentimento.
6. A fila legada com valor `1` fica preservada e bloqueada até abrir o dia e confirmar. Não reescreve nem transmite silenciosamente dias antigos com OS.
7. Uma requisição por snapshot, timeout 15 s, máximo 8 tentativas persistidas. Rede, 408, 429 e 5xx podem repetir, com backoff exponencial/jitter e Retry-After. Erros permanentes bloqueiam sem fallback em lote. Esgotamento exige revisão/novo consentimento. Ack só remove a fila se o payload ainda for idêntico.
8. Perda de ack preserva snapshot. Reenvio converge pelo upsert dispositivo/data. Isso não torna `confirmacao` uma autenticação criptográfica; o protocolo anterior de identidade do aparelho e a proteção administrativa não foram alterados.

Limite operacional: edição simultânea da mesma chave em várias abas não tem lock distribuído; D1 garante unicidade da linha, mas a última atualização recebida vence. O sincronizador de uma aba não dispara envios concorrentes. Não abrir o mesmo aparelho em abas concorrentes durante a homologação.

## Validação reexecutável, sem downloads

Requer Node 24 com suporte nativo a TypeScript e `node:sqlite`. Execução verificada neste checkout: Node v24.15.0, SQLite 3.51.3, TypeScript já instalado. Não usar instaladores nem comandos que baixem pacotes.

```bash
npm test
npm run check
# Compilador já existente, caminho alternativo solicitado no briefing:
node 'C:/Users/42297/Downloads/Aplicativo OS Datta/node_modules/typescript/bin/tsc' --noEmit --strict --target es2022 --module es2022 --moduleResolution bundler --skipLibCheck --lib es2022,dom functions/api/apontamentos.ts
# Somente servidor sintético local, binding 127.0.0.1, SQLite em memória:
npm run preview:local
```

`tests/logic.test.js` e `tests/app_logic.test.js` foram substituídos: não definem mais algoritmos fictícios. Os testes importam o módulo real, executam o JS extraído das telas e importam a API TS real. O adaptador D1 executa o SQL real sobre SQLite em memória. `npm run check` verifica todos os JS públicos, scripts inline de ambas as páginas e o TypeScript ativo. Os logs finais e os exitcodes ficam em `evidence/`. Resultado final deste executor: **43 testes passaram, zero falhas**, `npm run check` exit 0 e compilador externo solicitado exit 0. O orquestrador havia repetido os 38 testes da suíte anterior com sucesso; os cinco novos casos cobrem CRUD, troca reversível para O, journal de crash, esgotamento de retry e exclusão de API do SW.

Casos cobertos incluem cancelamento, voltar, reabrir, duplicadas, editar/remover intervalos, validações app/API, almoço sem dupla contagem, HE50/100, zero ociosidade/produtivo, O/A/F, legado sem campo, migração sem reescrita, reload→sync payload idêntico, perda de ack, resposta antiga após nova aprovação, bloqueio de erro permanente e persistência do orçamento de retry.

### Evidência de navegador e validação independente

Navegador local real, viewport 390×844, somente fixtures sintéticas: exibiu 3 OS (uma duplicada), foco em `tituloRevisao`, 483 min produtivos, 45 min ociosos e nenhuma gravação em `apt`/fila antes da confirmação. Confirmou com `navigator.onLine=false`. Após reload com API bloqueada, o snapshot persistiu; ao restabelecer API local, GET de leitura confirmou snapshot idêntico. Draft alterado para 18:00 não foi enviado: servidor conservou 17:18 e fila ficou `{}`. Captura: `evidence/revisao-mobile.png`.

**Limitação do navegador deste executor:** recarregar a casca completamente sem rede via Service Worker. O Cache API do navegador de ensaio retornou `InvalidAccessError: Entry already exists` tanto em `Cache.addAll` quanto em `Cache.put` individual para URLs distintas; instalação do SW foi desfeita. Não se alterou código para esconder essa falha. O teste automatizado valida persistência offline/reload/sync do estado. Em nota posterior nesta tarefa, o orquestrador informou validação independente bem-sucedida: SW ativo, oito assets em cache, confirmação offline via CDP e reload com snapshot/fila preservados. O erro de Cache API deste executor não se reproduziu no navegador do orquestrador. `public/sw.js` usa cache `apontamento-preview-ociosidade-v5`, inclui `domain.js`/`workflow.js` no precache e mantém `/api/` fora dele. Hostnames distintos separam localStorage/cache de Preview e produção.

`pygount` não está no Python ativo; instalação não foi autorizada. `graphify build .` foi executado na inspeção inicial. Nenhuma métrica de pygount foi inventada.

## Migração e gate de Preview — responsabilidade do orquestrador

1. Antes de qualquer publicação, reler diff, repetir `npm test` e `npm run check` com checkout estável, e repetir navegador incluindo a lacuna PWA.
2. Confirmar na configuração efetiva de Pages que **somente Preview** aponta `osdatta-preview-ociosidade`, ID `6672d0f0-2945-4bb8-89b2-d5d14a1a6b24`. O override está em `env.preview.d1_databases` de `wrangler.toml`; a configuração top-level foi preservada. Não inferir isolamento apenas do arquivo: verificar binding efetivo e branch de destino na plataforma.
3. **Já aplicado pelo orquestrador, conforme nota nesta tarefa:** `0001` e `0002` exclusivamente no D1 Preview `6672d0f0-2945-4bb8-89b2-d5d14a1a6b24`. O orquestrador informou read-back da coluna, default, CHECK array e zero apontamentos. Não reaplicar o ALTER remoto. Verificar histórico de migrações/schema antes de qualquer ação posterior. A migração é exclusivamente ALTER ADD, com default `[]` e CHECK JSON array; não contém UPDATE/DELETE. O teste SQLite local preservou todas as colunas e bytes da fixture legada.
4. Publicar somente a branch revisão no Preview após o gate. Conferir schema/binding e executar fixtures sintéticas, CRUD, confirmação, gestor, CSV/JSON, offline e retry. Nenhum comando remoto foi executado nesta tarefa.
5. Produção permanece proibida. Qualquer futura promoção exige outra aprovação explícita, backup validado, plano de retorno e validação dos IDs reais pelo orquestrador. O arquivo top-level não deve ser usado para aplicar SQL durante esta homologação.

### Retorno sem apagar dados

Antes do rollout de teste, preservar snapshots do armazenamento e histórico. Em falha, interromper publicações/envios do teste e retornar ao artefato estável de Preview. Manter a coluna nova e suas informações; não executar DROP/DELETE nem apagar `apt`, `apt_pend`, `apt_drafts` ou registros legados. A versão anterior não conhece o novo consentimento: não usá-la para reenviar pendências sem revisão. A migração SQL não é para reexecução cega: usar controle de migrações do ambiente.

## Handoff

Dono da implementação: `agency-automation-engineer`. Próxima ação: `agency-orchestrator` faz revisão independente e decide publicação exclusiva de Preview. Fontes: este checkout e briefing original; período de teste sintético 2026-11, sem dados pessoais/saúde. Riscos pendentes: binding efetivo no momento da publicação e concorrência entre abas. PWA offline foi aprovado no navegador independente do orquestrador, conforme sua nota; o navegador deste executor apresentou limitação de Cache API documentada acima. Não há alegação de deploy concluído.

