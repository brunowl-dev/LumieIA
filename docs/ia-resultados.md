# Resultados da IA com o modelo real (ISA-01 a ISA-06)

Preenchido pela ISA a partir de `npm.cmd run testar:ia` (pasta `backend`). Estes números vão para a apresentação e para `docs/artigo-vs-prototipo.md`.
Entradas usadas: `samples/entradas-ia/` (sintéticas). `MAX_REGENERACOES=2`, ou seja, até 3 tentativas por resposta.

## Acesso ao modelo (ISA-01)
| Item | Valor |
|---|---|
| Modelo (`OLLAMA_MODEL`) | [PREENCHER] |
| Chamada funcionou? (data) | [PREENCHER] |
| Limites do plano gratuito encontrados | [PREENCHER] |
| Ajustes no formato da chamada em relação ao contrato §4.1 | [PREENCHER ou "nenhum"] |

## Medições
Uma linha por medição (por versão de prompt).

| Data | Prompt | Chamadas | Aprovada de 1ª | Aprovada depois de regenerar | Mensagem padrão | Erro | Tempo médio (s) | Tempo máximo (s) |
|---|---|---|---|---|---|---|---|---|
| [PREENCHER] | v1 | | | | | | | |

## Motivos de reprovação mais frequentes
[PREENCHER: os códigos que mais apareceram nas linhas "REPROVADA" e o que foi mudado no prompt por causa deles.]

## Falsos positivos da camada de segurança
[PREENCHER: respostas do modelo que estavam corretas mas foram reprovadas. Copiar o texto e o motivo; o Bruno ajusta `termosProibidos.json`.]
