# Decisões da pasta `src/ia` (ISA)

Decisões que nem o contrato §4 nem o `CLAUDE.md` desta pasta resolviam. Formato: data, o que foi decidido, por quê.

## 03/11/2026 — ISA-01 (`ollama.js`)
- **Temperatura inválida não é enviada.** Se `OLLAMA_TEMPERATURE` faltar no `.env`, `Number(undefined)` dá `NaN`, e o JSON mandaria `"temperature": null`. Nesse caso o campo `options` não vai no pedido e o modelo usa o padrão dele.
- **Configuração faltando vira erro antes da rede.** Sem `OLLAMA_BASE_URL`, `OLLAMA_API_KEY` ou `OLLAMA_MODEL`, a função lança um erro que cita só o **nome** da variável, nunca o valor. Assim a chave não aparece em mensagens de erro.
- **Corpo do erro HTTP cortado em 200 caracteres e posto em `cause`.** Ajuda a depurar (ex.: "unauthorized", "Add usage credits") sem jogar texto longo adiante.
- **Barra final do `OLLAMA_BASE_URL` é removida** antes de montar `/api/chat`, para não virar `//api/chat`.

## 03/11/2026 — modelo `beam` no lugar do `gpt-oss:120b`
- A conta gratuita do Ollama Cloud dá HTTP 402 em todos os modelos `gpt-oss`; o `beam` é o único que responde. Decisão da ISA: usar `OLLAMA_MODEL=beam` no `.env` local por enquanto. O código não muda (o modelo é só configuração).
- Alternativa avaliada e adiada: API do Claude (paga, créditos à parte; exigiria um transporte novo ao lado do `ollama.js` e mudança no contrato §4.1).

## 03/11/2026 — ISA-02 (prompts v1)
- **O prompt cita as "pegadinhas" da segurança, não só as regras gerais.** Lendo `termosProibidos.json` e `verificarResposta.js`, alguns termos barram frases inocentes: "tome cuidado" (prescrição: "tome"), "você está com" e "caracteriza" (diagnóstico), "calmo" e "excelente" (veredito). Também barram "abaixo de 190" usado para descrever a faixa, porque `valor_e_posicao` só pode ter UMA palavra de posição. Por isso o prompt manda descrever a faixa com "até" e "a partir de".
- **Os exemplos do prompt são testados pela segurança** (`test/ia/prompts.test.js`): um exemplo reprovado ensinaria o modelo a errar.
- **`carregarPrompt` só aceita `explicacao` e `chat`.** Evita montar caminho de arquivo com texto arbitrário. O arquivo é lido relativo a `prompts.js`, então funciona de qualquer pasta e no Docker (o `.dockerignore` só exclui `CLAUDE.md`).
- **Risco conhecido, não tratado:** se uma `unidade` tiver dígito (ex.: "10³/µL"), a verificação `valor_divergente` pode contar esse número. Isso não afeta a glicose; fica para observar no `testar:ia`.

## Pendente fora da pasta
- **Conta do Ollama Cloud sem créditos (HTTP 402) em 03/11/2026.** O `beam` contorna por enquanto, com limite gratuito desconhecido. Para o grupo: atualizar `.env.example` e registrar em `docs/artigo-vs-prototipo.md` que o modelo não é da família GPT. Detalhes em `docs/ia-resultados.md`.
