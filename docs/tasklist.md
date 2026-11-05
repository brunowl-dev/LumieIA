# Tasklist — Lumie (módulo de IA)

**Data limite:** apresentação em **05/11/2026**.
**Donos:** Bruno (**BWL**) = pipeline, segurança e orquestrador · Isadora (**ISA**) = IA · Aguiar (**MAG**) = front e base de conhecimento.
**Prioridades:** P0 = sem isso não há demo · P1 = muito desejável · P2 = só se sobrar tempo.
**Como usar:** marque `[x]` ao concluir. Dúvida sobre o formato dos dados? Veja `contrato.md`. Dúvida sobre como trabalhar com o Claude Code? Veja o `CLAUDE.md` da sua pasta.

---

## Tarefas em comum (GRP)

- [X] **GRP-01 (P0)** Ler e aprovar o `docs/contrato.md` (gerado pelo Claude). Resolver as "Decisões em aberto" no fim dele e preencher "Congelado em".
- [X] **GRP-02 (P0)** Confirmar os exames do protótipo: glicose, colesterol total, creatinina, TSH e hemoglobina (tabela "Exames do protótipo" abaixo). Outros só se acabarem sendo gerados, de preferência seguindo os especificados. A escolha define laudos, regras, base e telas.
- [x] **GRP-03 (P1)** Manter `docs/artigo-vs-prototipo.md` atualizado. O artigo já foi enviado: se o protótipo divergir, precisamos saber explicar.
- [ ] **GRP-04 (P1)** Roteiro da apresentação e plano B em vídeo gravado (a demo depende de internet por causa do modelo na nuvem).
- [x] **GRP-05 (P0)** Criar `Dockerfile` do front, do back e o `docker-compose.yml`, seguindo `docs/docker.md`. Responsável: [DEFINIR — quem tiver mais familiaridade com Docker]. Só dá para fechar quando cada serviço tiver o seu `package.json`.
- [ ] **GRP-06 (P0)** Isadora (feito em `backend/src/ia/CLAUDE.md`) e Aguiar: preencher o "Modo de trabalho" no `CLAUDE.md` da sua pasta.

---

## BWL — Bruno: pipeline, segurança e orquestrador

**Requisitos funcionais**
- RF-B1: ler PDF digital (pdf-parse).
- RF-B2: ler imagem/escaneado com OCR (Tesseract.js).
- RF-B3: estruturar por analito (nome, valor, unidade, faixa do laudo).
- RF-B4: classificar por regra determinística (dentro/acima/abaixo) e acionar alerta por limite crítico.
- RF-B5: medir a confiança da extração e pedir novo envio se baixa.
- RF-B6: pseudonimizar: nada que identifique o paciente sai do pipeline.
- RF-B7: validar a resposta do modelo (aviso, especialidade confere com a base, sem diagnóstico/prescrição/veredito); reprovou → regenerar; esgotou → mensagem padrão.
- RF-B8: expor as rotas e orquestrar: envio do laudo → pipeline (sem IA); clique em "Explicar com IA" e chat → IA → segurança, com o laço de regeneração no orquestrador.

**Requisitos não funcionais**
- RNF-B1: o modelo nunca decide classificação nem alerta.
- RNF-B2: só laudos sintéticos.
- RNF-B3: cada etapa testável isoladamente.
- RNF-B4: limites críticos com fonte citável.
- RNF-B5: chaves de API fora do repositório (`.env`).

**Tarefas**
- [x] **BWL-01 (P0)** Laudos sintéticos em PDF, com paciente FICTÍCIO, em `samples/laudos/`. Para cada exame: normal, acima e abaixo da faixa (tabela abaixo), em dois layouts, mais versões "foto" para o OCR e `gabarito.json` (resposta esperada). Detalhes em `samples/laudos/README.md`.
- [x] **BWL-02 (P0)** Extração de texto do PDF digital, testada isolada.
- [x] **BWL-03 (P0)** Estruturação por analito (nome, valor, unidade, faixa), testada isolada. Atenção a vírgula decimal.
- [x] **BWL-04 (P0)** Normalizar o nome do exame para o `id_canonico` (usa `nomes_alternativos` da base).
- [x] **BWL-05 (P0)** Regras de classificação + limites críticos por analito, **cada limite com fonte**. Se um exame não tem limite crítico definido (ex.: colesterol), documentar isso. → `docs/limites-criticos.md` (TSH e colesterol sem limite).
- [x] **BWL-06 (P0)** Confiança da extração e erro "envie novamente". → `docs/confianca-extracao.md`.
- [x] **BWL-07 (P0)** Pseudonimização, com teste que prove que nenhum identificador sai. → `docs/pseudonimizacao.md` (prova sobre a ENTRADA da IA; o pacote final ao Ollama depende da ISA).
- [x] **BWL-08 (P0)** Camada de segurança com as verificações, testada com `samples/respostas-ia/` e casos novos. → `docs/seguranca-verificacoes.md` (testada só com respostas escritas pelo grupo).
- [x] **BWL-09 (P0)** Orquestrador e rotas do contrato (`/api/laudos`, `/api/explicacoes`, `/api/chat`), sessão em memória (laudo + histórico do chat de cada exame) e laço de regeneração. → ligado ao modelo real (`beam`) com `IA_FALSA=false` desde 04/11 (a IA falsa continua para testes).
- [x] **BWL-10 (P1)** OCR com Tesseract.js. → foto JPG/PNG e PDF digitalizado; confiança média da página; correções de letra (nunca dígito). Medido e decidido em `docs/confianca-extracao.md`.
- ~~**BWL-11 (P2)** Lembrete de medicação.~~ **Cortada em 04/11/2026** por prazo (registrado em `artigo-vs-prototipo.md`).

---

## ISA — Isadora: IA

**Requisitos funcionais**
- RF-I1: gerar a explicação sempre nas 5 partes e na ordem: (1) o que o exame avalia; (2) valor e posição na faixa; (3) significado sem afirmar doença; (4) especialidade; (5) aviso.
- RF-I2: injetar no prompt a ficha do exame (RAG: o orquestrador busca a ficha pelo `id_canonico` e a entrega pronta); em divergência, a base prevalece.
- RF-I3: responder no chat apenas sobre aquele exame (a explicação é a 1ª mensagem do chat), sem memória entre sessões.
- RF-I4: aceitar o motivo da reprovação da segurança numa nova tentativa (quem decide tentar de novo é o orquestrador).

**Requisitos não funcionais**
- RNF-I1: nunca diagnosticar, indicar/ajustar medicamento nem dar veredito de tranquilidade ou preocupação. Linguagem de "merece atenção"; sem a palavra "preocupante".
- RNF-I2: o modelo só recebe dados estruturados e pseudonimizados.
- RNF-I3: prompt versionado e documentado.
- RNF-I4: resposta em tempo aceitável para a demo.

**Tarefas** — roteiro passo a passo, arquivos e critérios de pronto em `backend/src/ia/CLAUDE.md`; interface no contrato §4; testes de aceitação em `backend/test/ia/clienteIa.test.js` (tirar o `todo` de cada um); medições em `docs/ia-resultados.md`.
- [x] **ISA-01 (P0)** Acesso ao modelo (Ollama Cloud; `gpt-oss` deu 402, usa-se `beam`) com uma chamada simples isolada. Verificar se o modelo está disponível na conta e quais são os limites do plano gratuito.
- [x] **ISA-02 (P0)** Prompt de instruções com as 5 partes e as proibições (`ia/prompts/v1`).
- [x] **ISA-03 (P0)** Busca na base por `id_canonico` e montagem do prompt. → a busca já é feita pelo orquestrador: a ficha chega pronta na entrada (contrato §4.0 e §4.2); fica para a ISA a montagem do prompt.
- [x] **ISA-04 (P0)** Função "analito estruturado → 5 partes", testada com os JSONs de `samples/`.
- [x] **ISA-05 (P1)** Respostas às dúvidas digitadas no chat do exame (analito + ficha + histórico).
- [x] **ISA-06 (P1)** Usar o motivo da reprovação da segurança para corrigir a nova tentativa.
- ~~**ISA-07 (P2)** Redação do tom do lembrete (horários e doses nunca vêm do modelo).~~ **Cortada em 04/11/2026** por prazo.

---

## MAG — Aguiar: front e base de conhecimento

> A ligação front↔back está **em aberto** (ver "Decisões em aberto" no contrato).

**Requisitos funcionais**
- RF-A1: tela de envio de laudo (PDF/foto).
- RF-A2: tela de exames: um cartão por exame com valor, faixa, status verde/amarelo/vermelho e botão "Explicar com IA" (quando `explicacao_disponivel`).
- RF-A3: estado "não consegui ler, envie de novo".
- RF-A4: destaque visual para alerta de atendimento prioritário.
- RF-A5: chat do exame: abre com a explicação em 5 partes (especialidade e aviso) e permite digitar dúvidas.

**Requisitos não funcionais**
- RNF-A1: linguagem simples.
- RNF-A2: não depender só de cor (também texto/ícone), por causa de daltonismo.
- RNF-A3: aviso "não substitui avaliação médica" sempre visível.
- RNF-A4: funcionar com os JSONs de `samples/` antes de o back existir.

**Tarefas — front**
- [ ] **MAG-01 (P0)** Telas de envio, de exames e do chat mostrando a explicação (1ª mensagem), usando os JSONs de `samples/respostas-api/`.
- [ ] **MAG-02 (P0)** Estados de erro (um por código do contrato) e alerta crítico.
- [ ] **MAG-03 (P1)** Ligar ao back real (sujeito à decisão em aberto).
- [ ] **MAG-04 (P1)** Campo para digitar dúvidas no chat e exibir as respostas.

**Tarefas — base de conhecimento**
- [ ] **MAG-05 (P0)** Com o grupo, confirmar a lista de exames e os nomes como aparecem nos laudos de `samples/laudos/`.
- [ ] **MAG-06 (P0)** Ficha de `glicose`: leia, confira a fonte, ajuste.
- [ ] **MAG-07 (P0)** Fichas de `colesterol_total`, `creatinina`, `tsh` e `hemoglobina`.
  > Todas as fichas já foram preenchidas pelo Claude (texto baseado em fontes brasileiras: Ministério da Saúde/BVS, SES-DF, Hemoes, SBD e SBEM; especialidade escolhida pela área do órgão avaliado), com `status: "pendente"`. Falta a revisão humana (MAG-08) e marcar `pronto` (MAG-09). Enquanto estiverem `pendente`, o exame aparece sem botão de explicação (mas é reconhecido pelo nome e tem alerta crítico: contrato §3).
- [ ] **MAG-08 (P0)** Conferir as fontes e pedir revisão do texto a alguém. O artigo prevê revisão por profissionais de saúde como trabalho futuro, ou seja, **ainda não houve**: não afirmar que foi validado.
- [ ] **MAG-09 (P0)** Validar o `exames.json` (JSON sem erro) e marcar `status: "pronto"` em cada ficha concluída.

### Aguiar, leia: o que é a base de conhecimento
O modelo de IA já sabe, em geral, o que é glicose. A base **não é para ensinar isso a ele**. Ela serve para: (1) o sistema dizer sempre a mesma coisa sobre cada exame; (2) a camada de segurança ter com o que comparar (se o modelo citar uma especialidade diferente da base, a resposta é barrada); (3) cada informação ter fonte registrada. Se o modelo "achar" algo diferente, **a base vence**.

Você escreve **uma ficha por exame** em `docs/base-conhecimento/exames.json`, com: nomes alternativos (como o exame aparece nos laudos), o que o exame avalia (1 a 3 frases, linguagem simples), **uma** especialidade, a fonte e o status. **Não escreva** valores de referência (vêm do laudo), diagnóstico, remédio ou palavras como "preocupante". Instruções completas e exemplos de nomes em `docs/base-conhecimento/README.md`.

### Exames do protótipo (definidos — GRP-02)
| `id_canonico` | Nome nos laudos de `samples/laudos/` | Unidade | Faixa impressa nos laudos* | Especialidade (base) |
|---|---|---|---|---|
| `glicose` | Glicose em jejum | mg/dL | 70 a 99 | Endocrinologia |
| `colesterol_total` | Colesterol total | mg/dL | Inferior a 190 | Cardiologia |
| `creatinina` | Creatinina | mg/dL | 0,6 a 1,3 | Nefrologia |
| `tsh` | TSH | µUI/mL (= mUI/L) | 0,45 a 4,50 | Endocrinologia |
| `hemoglobina` | Hemoglobina | g/dL | 12,0 a 16,0 | Hematologia |

\* Faixas ILUSTRATIVAS, só para criar os laudos de teste. Cada laboratório define a sua faixa; o sistema sempre usa a do laudo. Outros nomes de cada exame estão em `nomes_alternativos` de `docs/base-conhecimento/exames.json`.

### Valores usados nos laudos sintéticos (BWL-01)
| Exame | Normal | Acima | Abaixo | Outros |
|---|---|---|---|---|
| `glicose` (mg/dL) | 88 | 118 | 62 | crítico 486 e 38; fronteira 99 |
| `colesterol_total` (mg/dL) | 172 | 238 | — (não se aplica) | fronteira 190 |
| `creatinina` (mg/dL) | 0,9 | 1,8 | 0,3 | |
| `tsh` (µUI/mL) | 2,35 | 7,80 | 0,12 | |
| `hemoglobina` (g/dL) | 13,8 | 17,2 | 10,4 | |

Valores **fictícios**; a lista exata por arquivo está em `samples/laudos/gabarito.json`. Os JSONs de `samples/*.json` usam outros valores de propósito (servem para testar a IA, não o parser). Os limites críticos reais precisam de fonte (BWL-05); os casos críticos de glicose em `samples/` são ilustrativos.
