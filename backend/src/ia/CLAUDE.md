# CLAUDE.md — backend/src/ia (Isadora — ISA)

Leia antes: `../../../CLAUDE.md` (raiz) e **`../../../docs/contrato.md` §4** (a interface desta pasta, com todas as decisões fechadas). Este arquivo é o roteiro de execução.

## Modo de trabalho nesta pasta (substitui o padrão da raiz)
- **Implemente direto, sem pedir confirmação a cada passo e sem fazer perguntas de projeto.** As decisões estão no contrato §4 e aqui.
- Se aparecer algo que nem o contrato nem este arquivo resolvem: escolha a opção **mais simples** que mantenha os testes de `backend/test/ia/` passando, registre em `DECISOES.md` (nesta pasta: data, o que foi decidido, por quê) e siga.
- Pergunte à pessoa **só** o que você não consegue obter sozinho: a chave da API (`OLLAMA_API_KEY` no `.env`) e o resultado de um teste que exige internet, se você não puder rodá-lo.
- Ao terminar cada passo, explique em poucas linhas o que cada arquivo novo faz e por quê: a Isadora precisa defender isto na banca (05/11/2026).
- Um commit por passo, na branch `isadora/ia`, com mensagem descritiva. Não faça push.

## O que você PODE e NÃO PODE editar
| Pode | Não pode (se achar que precisa, anote em `DECISOES.md` como "pendente para o Bruno" e siga) |
|---|---|
| `backend/src/ia/**` | `backend/src/api/**`, `backend/src/seguranca/**`, `backend/src/pipeline/**` |
| `backend/test/ia/**` (só para **tirar** os `todo` e acrescentar testes; não enfraqueça o que já confere) | `docs/contrato.md` |
| `docs/ia-resultados.md` (preencher) | `samples/entradas-ia/**`, `samples/respostas-ia/**` |
| `.env` local (nunca commitar) | `.env.example`, `docker-compose.yml` |

## O que já existe (não refaça)
- `index.js`: **esqueleto** com a forma final (`criarClienteIa` → `gerarExplicacao` e `responderChat`). As funções lançam "não implementada". Preencha-as; não mude nomes nem parâmetros.
- `../../test/ia/clienteIa.test.js`: **testes de aceitação** já escritos, marcados com `{ todo: 'ISA-0x' }`. Cada passo abaixo diz quais tirar do `todo`.
- `../../scripts/testarIa.js`: teste manual com o modelo real (`npm.cmd run testar:ia`), que roda o mesmo laço de segurança do servidor e imprime um resumo.
- `../../../samples/entradas-ia/`: as entradas exatas que esta pasta recebe (geradas pelo código de pseudonimização).
- O resto do fluxo (pseudonimização, busca da ficha, camada de segurança, laço de regeneração, tempo limite, sessão, rotas) é do Bruno e já funciona com uma IA falsa.

## Passo a passo
Rodar os testes sempre na pasta `backend`: `npm.cmd test` (Windows/PowerShell: use `npm.cmd`, não `npm`). Sem dependências novas: use o `fetch` nativo do Node.

### Passo 1 — ISA-01: chamada ao Ollama
- Criar `ollama.js` com `chamarOllama(config, { system, user, format })` → `Promise<string>` (o `message.content`).
  - `config` = `{ fetch, baseUrl, apiKey, modelo, temperatura }`.
  - Pedido: contrato §4.1 (`POST {baseUrl}/api/chat`, `Authorization: Bearer`, `stream: false`, `format`, `options.temperature`, `messages` = system + user).
  - Erro de rede, HTTP fora de 2xx ou sem `message.content` string → `throw new Error(...)` com `cause`. Sem nova tentativa.
  - Ignorar `message.thinking`.
- Em `index.js`, `criarClienteIa` monta o `config` a partir de `opcoes`, com padrão em `process.env` (`OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_MODEL`, `Number(OLLAMA_TEMPERATURE)`) e `globalThis.fetch`. Ler o ambiente **dentro** de `criarClienteIa`, não no topo do módulo.
- Verificar com a pessoa: a chave está no `.env` da raiz? Se a chamada real der 401/404, conferir a documentação do Ollama Cloud (docs.ollama.com) e ajustar **só** `ollama.js`; registrar em `DECISOES.md`.
- Anotar em `docs/ia-resultados.md` (seção "Acesso ao modelo"): modelo usado, se funcionou, limites do plano gratuito encontrados.

### Passo 2 — ISA-02: prompts v1
- Criar `prompts/v1/explicacao.md` e `prompts/v1/chat.md` (texto puro, em português). Criar `prompts.js` com `carregarPrompt(nome)` que lê `prompts/${VERSAO_PROMPT}/${nome}.md` (constante `VERSAO_PROMPT = 'v1'` em `prompts.js`).
- `explicacao.md` precisa ter, nesta ordem:
  1. Papel: assistente que explica UM exame de sangue a um paciente leigo, em português simples, frases curtas.
  2. A entrada: um JSON com `analito` e `ficha` (descrever os campos do contrato §4.2). A `ficha` prevalece sobre o conhecimento do modelo.
  3. A saída: JSON com os 5 campos, cada regra da tabela do contrato §4.3, incluindo: em `valor_e_posicao`, só os números `valor`, `minimo` e `maximo` (com vírgula decimal) e uma única palavra de posição igual à `classificacao`; em `especialidade`, só o nome copiado de `ficha.especialidade`; em `aviso`, a frase exata "Esta explicação é informativa e não substitui a avaliação de um profissional de saúde."
  4. Se `alerta_critico` for `true`: dizer em `significado` que o resultado tem alerta de atendimento prioritário e que o paciente deve procurar um serviço de saúde assim que possível.
  5. Proibições: não diagnosticar nem sugerir doença; não indicar, ajustar ou citar remédio, dose ou tratamento; não dar veredito ("está tudo bem", "não há motivo para preocupação", "é grave"); não usar a palavra "preocupante" (usar "merece atenção"); não repetir marcadores entre colchetes como `[PACIENTE_1]`. Usar como exemplos alguns termos de `../seguranca/termosProibidos.json`.
  6. Um exemplo completo de saída boa (copiar de `samples/respostas-ia/aprovada-glicose-normal.json`, sem o campo `id_canonico`).
- `chat.md`: mesmo papel e proibições; a entrada tem também `historico` e `mensagem` (contrato §4.2); saída `{ "resposta": "..." }`; regras do contrato §4.4 (só sobre aquele exame; recusar fora do tema, remédio ou diagnóstico indicando `ficha.especialidade`; citar só essa especialidade; **terminar** com o aviso). Exemplo: `samples/respostas-ia/chat-aprovada.json` e `chat-aprovada-recusa-medicamento.json`.

### Passo 3 — ISA-03 e ISA-04: explicação
- Criar `esquemas.js` com dois JSON Schemas: `ESQUEMA_EXPLICACAO` (objeto, os 5 campos `string`, todos em `required`) e `ESQUEMA_CHAT` (objeto, `resposta: string`, `required`).
- Criar `mensagens.js` com `montarMensagens(nomePrompt, entrada, motivosReprovacao)` → `{ system, user }`: `system` = prompt carregado + (se houver motivos) uma seção "Correções da tentativa anterior" com uma instrução por código (Passo 5); `user` = `JSON.stringify(entrada)`. A ficha já vem na entrada: **não** ler `exames.json`.
- `gerarExplicacao`: `montarMensagens('explicacao', ...)` → `chamarOllama(..., format: ESQUEMA_EXPLICACAO)` → `JSON.parse` do texto → devolver o objeto **como veio** (sem completar nem corrigir campos). Se o texto não for JSON, devolver o texto (o adaptador e a segurança tratam).
- Tirar o `todo` dos testes `ISA-04` e fazê-los passar.
- Rodar `npm.cmd run testar:ia` com a chave e anotar o resumo em `docs/ia-resultados.md`.

### Passo 4 — ISA-05: chat
- `responderChat`: igual, com `'chat'` e `ESQUEMA_CHAT`. Devolver `{ resposta }` como veio.
- Tirar o `todo` dos testes `ISA-05`.

### Passo 5 — ISA-06: correção pelos motivos
- Em `mensagens.js`, um objeto `INSTRUCOES` com uma função por código da §8, que recebe a entrada e devolve a frase. Usar as frases da tabela do contrato §4.6, trocando `{valor}`, `{minimo}`, `{maximo}`, `{classificacao}` e `{ficha.especialidade}` pelos valores da entrada (números com vírgula decimal). Código desconhecido → ignorar.
- Tirar o `todo` dos testes `ISA-06`.

### Passo 6 — Ligar e medir
- `npm.cmd test` inteiro verde e `testar:ia` com o modelo real.
- Rodar `npm.cmd run testar:ia -- 5` e preencher `docs/ia-resultados.md` (resumo e tempos). Se muitas respostas forem reprovadas, criar `prompts/v2/` (sem apagar a v1), trocar `VERSAO_PROMPT` e medir de novo; registrar as duas medições.
- Para a demo: no `.env`, `IA_FALSA=false`; subir com `docker compose up --build` e testar pelo navegador. Voltar para `IA_FALSA=true` desliga o modelo sem mexer no código.

## Regras (valem em todos os passos)
- O modelo recebe só a `entrada` pronta (pseudonimizada) e o prompt. Nunca o laudo, nunca o nome do paciente.
- O modelo não decide classificação nem alerta: eles vêm na entrada; o prompt manda só explicá-los.
- **Nada de `console.log`/`console.error` em `src/ia`** (há teste para isso). Erros saem por `throw`.
- Nada de chave, URL ou nome de modelo fixos no código: só por `opcoes` ou `process.env`.
- Sem nova tentativa, sem tempo limite e sem mensagem de reserva aqui: isso é do orquestrador.
- Lembretes (ISA-07): **cortados em 04/11/2026 por prazo**. Não implementar.
