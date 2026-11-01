# samples/ — dados fictícios

**Tudo aqui é sintético.** Nunca coloque laudo real de pessoa (LGPD).

## O que há
- `glicose-normal.json`, `glicose-alterada.json`, `glicose-critica.json`, `varios-exames.json`: exemplos do "laudo estruturado" (saída do pipeline, contrato §2). `varios-exames.json` tem glicose, creatinina, TSH e um exame sem ficha na base (hemoglobina, `id_canonico: null`). O limite crítico usado no exemplo crítico é **ilustrativo**: o limite real depende de fonte (tarefa BWL-05).
- `respostas-ia/`: exemplos de resposta do modelo para testar a camada de segurança: 1 aprovada, 1 reprovada por diagnóstico/prescrição, 1 reprovada por falta de aviso. São dados de teste, não saída de modelo real.
- `respostas-api/`: o que o front recebe do back (contrato §5 e §7), para o front funcionar antes de o back existir:
  - `laudo-resultado.json` — tela de exames (resposta de `POST /api/laudos`), gerada a partir de `varios-exames.json`; inclui um item sem botão de explicação.
  - `laudo-resultado-critico.json` — tela de exames com alerta prioritário (a partir de `glicose-critica.json`).
  - `explicacao-glicose.json` — 1ª mensagem do chat (resposta de `POST /api/explicacoes`).
  - `explicacao-mensagem-padrao.json` — a mesma, quando a segurança reprovou todas as tentativas.
  - `chat-resposta.json` — resposta a uma dúvida digitada (`POST /api/chat`).
  - `erro-arquivo-ilegivel.json` — exemplo do formato de erro.

## A fazer
- `laudos/`: PDFs sintéticos (feitos no Word ou com IA e exportados) para cada exame, nas versões normal, acima e abaixo, e uma versão "foto" para o OCR (tarefa BWL-01). Cada laudo deve ter dados de paciente FICTÍCIOS.
