# mocks/ — respostas falsas da API

Os arquivos `laudo-*.json`, `explicacao-*.json`, `chat-resposta.json` e `erro-arquivo-ilegivel.json` são **cópias** de `samples/respostas-api/`.
Eles ficam aqui porque o Docker compila o front só com a pasta `frontend/` e não enxerga `../samples`.
Se o Bruno mudar os samples, copie de novo.

`erros.json` tem um exemplo para cada código de erro do contrato (§7). Só o texto de `ARQUIVO_ILEGIVEL` vem do sample oficial; os demais são sugestões do front.

Quem usa estes arquivos é `src/api.js`, apenas quando o modo mock está ligado.
