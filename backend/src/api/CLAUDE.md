# CLAUDE.md — backend/src/api (Bruno — BWL)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seções "Visão do fluxo", "Portas HTTP" e "Erros").

## Escopo desta pasta
- Rotas HTTP do contrato (enviar laudo, explicar exame, chat, saúde). Lembretes foram cortados.
- **Orquestrador:** é o único lugar que chama os três módulos. Três fluxos:
  1. `POST /api/laudos`: valida o upload → pipeline → guarda o laudo estruturado na sessão → monta o resultado da tela de exames (cor, alerta, `explicacao_disponivel`). **Não chama a IA.**
  2. `POST /api/explicacoes`: busca o analito na sessão → IA → segurança → (laço de regeneração) → devolve a 1ª mensagem do chat.
  3. `POST /api/chat`: busca o analito e o histórico do chat na sessão → IA → segurança → (laço de regeneração) → guarda a troca no histórico → devolve a resposta.
- **O laço de regeneração mora aqui:** a segurança reprovou → chama a IA de novo passando o motivo, até `MAX_REGENERACOES`; esgotou → pede à segurança a mensagem padrão. Nem a IA nem a segurança fazem esse laço.

## Onde está cada coisa (BWL-09)
- `server.js` (em `src/`) monta as peças; `rotas.js` tem as 3 portas e a tradução de erros; `sessao.js` guarda a sessão em memória; `gerarComSeguranca.js` faz o laço de regeneração; `config.js` lê o `.env`.
- `adaptadorIa.js` é o ÚNICO caminho até a IA: pseudonimiza a entrada (`montarEntradaIa`), aplica o tempo limite e converte erro em `MODELO_INDISPONIVEL`. O cliente é escolhido por `IA_FALSA` (`config.js`): `true` (padrão) = `iaFalsa.js`; `false` = `criarClienteIa()` de `src/ia/index.js`.

## Regras
- Sem regra de negócio aqui: classificação fica no pipeline, validação e mensagem padrão na segurança, texto na IA. Esta pasta só liga as peças, decide a cor a partir de `classificacao`/`alerta_critico` (mapeamento do contrato) e traduz erros para o formato do contrato.
- Validar o upload: tipo (PDF/imagem), tamanho (`UPLOAD_MAX_MB`). Não guardar o arquivo em disco além do necessário; apagar após o processamento.
- Sessão em memória por `id_laudo`, com expiração (`SESSION_TTL_MINUTES`): o laudo estruturado e o histórico de chat de cada exame. Sem banco.
- `id_canonico` que não está no laudo ou sem ficha → `EXAME_NAO_ENCONTRADO`; `id_laudo` expirado → `SESSAO_EXPIRADA`.
- Erros sempre no formato do contrato, com mensagem em linguagem simples para o paciente.
- Sem CORS: o front chega à API pelo proxy do nginx (mesma origem). Não habilitar CORS (`docs/docker.md`).
- Se o modelo estiver indisponível/lento (`OLLAMA_TIMEOUT_MS`), devolver `MODELO_INDISPONIVEL` — ou a mensagem padrão, se o grupo decidir assim (decisão em aberto no contrato).

## Modo de trabalho (Bruno)
Modo GUIADO, como em `../pipeline/CLAUDE.md`. Explique o que é rota, middleware, upload multipart, sessão em memória e orquestração antes de implementar.
