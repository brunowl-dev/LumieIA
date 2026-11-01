# samples/ — dados fictícios

**Tudo aqui é sintético.** Nunca coloque laudo real de pessoa (LGPD).

## O que há
- `glicose-normal.json`, `glicose-alterada.json`, `glicose-critica.json`, `varios-exames.json`: exemplos do "laudo estruturado" (saída do pipeline, contrato §2). `varios-exames.json` tem glicose, creatinina, TSH, hemoglobina e um exame sem ficha na base (ureia, `id_canonico: null`). Esses JSONs servem para testar a IA e o front; os valores não precisam bater com os PDFs de `laudos/`. O limite crítico usado no exemplo crítico é **ilustrativo**: o limite real depende de fonte (tarefa BWL-05).
- `respostas-ia/`: exemplos de resposta do modelo para testar a camada de segurança: 1 aprovada, 1 reprovada por diagnóstico/prescrição, 1 reprovada por falta de aviso. São dados de teste, não saída de modelo real.
- `respostas-api/`: o que o front recebe do back (contrato §5 e §7), para o front funcionar antes de o back existir:
  - `laudo-resultado.json` — tela de exames (resposta de `POST /api/laudos`), gerada a partir de `varios-exames.json`; inclui um item sem botão de explicação (ureia).
  - `laudo-resultado-critico.json` — tela de exames com alerta prioritário (a partir de `glicose-critica.json`).
  - `explicacao-glicose.json` — 1ª mensagem do chat (resposta de `POST /api/explicacoes`).
  - `explicacao-mensagem-padrao.json` — a mesma, quando a segurança reprovou todas as tentativas.
  - `chat-resposta.json` — resposta a uma dúvida digitada (`POST /api/chat`).
  - `erro-arquivo-ilegivel.json` — exemplo do formato de erro.

- `laudos/`: laudos sintéticos em PDF (dois layouts) e fotos para o OCR, com `gabarito.json` (resposta esperada de cada arquivo). Glicose, colesterol total, creatinina, TSH e hemoglobina. Detalhes em `laudos/README.md` (tarefa BWL-01).
