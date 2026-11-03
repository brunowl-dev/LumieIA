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

## Pendente fora da pasta
- **Conta do Ollama Cloud sem créditos (HTTP 402) em 03/11/2026.** O `beam` contorna por enquanto, com limite gratuito desconhecido. Para o grupo: atualizar `.env.example` e registrar em `docs/artigo-vs-prototipo.md` que o modelo não é da família GPT. Detalhes em `docs/ia-resultados.md`.
