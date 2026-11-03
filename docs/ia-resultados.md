# Resultados da IA com o modelo real (ISA-01 a ISA-06)

Preenchido pela ISA a partir de `npm.cmd run testar:ia` (pasta `backend`). Estes números vão para a apresentação e para `docs/artigo-vs-prototipo.md`.
Entradas usadas: `samples/entradas-ia/` (sintéticas). `MAX_REGENERACOES=2`, ou seja, até 3 tentativas por resposta.

## Acesso ao modelo (ISA-01)
| Item | Valor |
|---|---|
| Modelo (`OLLAMA_MODEL`) | **`beam`** desde 03/11/2026 (o `.env.example` ainda diz `gpt-oss:120b`). Motivo: dos 25 modelos listados em `GET /api/tags`, só o `beam` respondeu na conta gratuita; os outros 23 deram HTTP 402 e o `clef:27b` deu HTTP 400 (não aceita `/api/chat`). Teste rápido do `beam`: JSON Schema respeitado, 8 de 8 respostas às entradas de `samples/entradas-ia/` aprovadas pela segurança, 3 a 7 s cada, com prompt provisório (não o v1). Fabricante e licença do `beam` não informados |
| Chamada funcionou? (data) | **Não**, em 03/11/2026: `POST /api/chat` respondeu **HTTP 402** nos dois modelos ("Add usage credits or subscribe", link para ollama.com/plans). A chave chega ao servidor (não deu 401), mas a conta está sem créditos ou sem plano para modelos na nuvem. Formato JSON (`format`) e tempo de resposta: **ainda não verificados** |
| Limites do plano gratuito encontrados | A conta usada não consegue gerar nenhuma resposta (402). Limites exatos do plano não verificados |
| Ajustes no formato da chamada em relação ao contrato §4.1 | Nenhum até agora (o pedido foi aceito até a etapa de cobrança) |

## Medições
Uma linha por medição (por versão de prompt).

| Data | Prompt | Chamadas | Aprovada de 1ª | Aprovada depois de regenerar | Mensagem padrão | Erro | Tempo médio (s) | Tempo máximo (s) |
|---|---|---|---|---|---|---|---|---|
| [PREENCHER] | v1 | | | | | | | |

## Motivos de reprovação mais frequentes
[PREENCHER: os códigos que mais apareceram nas linhas "REPROVADA" e o que foi mudado no prompt por causa deles.]

## Falsos positivos da camada de segurança
[PREENCHER: respostas do modelo que estavam corretas mas foram reprovadas. Copiar o texto e o motivo; o Bruno ajusta `termosProibidos.json`.]
