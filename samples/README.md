# samples/ — dados fictícios

**Tudo aqui é sintético.** Nunca coloque laudo real de pessoa (LGPD).

## O que há
- `glicose-normal.json`, `glicose-alterada.json`, `glicose-critica.json`, `varios-exames.json`: exemplos do "laudo estruturado" (saída do pipeline, contrato §2). `varios-exames.json` tem glicose, creatinina, TSH, hemoglobina e um exame sem ficha na base (ureia, `id_canonico: null`). Esses JSONs servem para testar a IA e o front; os valores não precisam bater com os PDFs de `laudos/`. O limite crítico usado no exemplo crítico é **ilustrativo**: o limite real depende de fonte (tarefa BWL-05).
- `entradas-ia/`: o que a IA recebe (contrato §4.2), gerado com `montarEntradaIa` a partir de `glicose-*.json` e da base: 3 explicações (dentro, acima, crítica) e 1 chat com histórico e um nome já trocado por marcador.
- `respostas-ia/`: 23 respostas de exemplo (explicação e chat) para testar a camada de segurança, listadas em `manifesto.json` com o resultado e os motivos esperados (BWL-08). São escritas pelo grupo, não saída de modelo real.
- `respostas-api/`: o que o front recebe do back (contrato §5 e §7), para o front funcionar antes de o back existir:
  - `laudo-resultado.json` — tela de exames (resposta de `POST /api/laudos`), gerada a partir de `varios-exames.json`; inclui um item sem botão de explicação (ureia).
  - `laudo-resultado-critico.json` — tela de exames com alerta prioritário (a partir de `glicose-critica.json`).
  - `explicacao-glicose.json` — 1ª mensagem do chat (resposta de `POST /api/explicacoes`).
  - `explicacao-mensagem-padrao.json` — a mesma, quando a segurança reprovou todas as tentativas.
  - `chat-resposta.json` — resposta a uma dúvida digitada (`POST /api/chat`).
  - `erro-arquivo-ilegivel.json` — exemplo do formato de erro.

- `laudos/`: laudos sintéticos em PDF (dois layouts) e fotos para o OCR, com `gabarito.json` (resposta esperada de cada arquivo). Glicose, colesterol total, creatinina, TSH e hemoglobina. Detalhes em `laudos/README.md` (tarefa BWL-01).
