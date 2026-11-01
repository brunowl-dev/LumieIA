# Tasklist — Lumie (módulo de IA)

**Data limite:** apresentação em **05/11/2026**.
**Donos:** Bruno (**BWL**) = pipeline, segurança e orquestrador · Isadora (**ISA**) = IA · Aguiar (**MAG**) = front e base de conhecimento.
**Prioridades:** P0 = sem isso não há demo · P1 = muito desejável · P2 = só se sobrar tempo.
**Como usar:** marque `[x]` ao concluir. Dúvida sobre o formato dos dados? Veja `contrato.md`. Dúvida sobre como trabalhar com o Claude Code? Veja o `CLAUDE.md` da sua pasta.

---

## Tarefas em comum (GRP)

- [ ] **GRP-01 (P0)** Ler e aprovar o `docs/contrato.md` (gerado pelo Claude). Resolver as "Decisões em aberto" no fim dele e preencher "Congelado em".
- [ ] **GRP-02 (P0)** Confirmar os exames do protótipo: glicose + colesterol total, creatinina e TSH (proposta). A escolha define laudos, regras, base e telas.
- [ ] **GRP-03 (P1)** Manter `docs/artigo-vs-prototipo.md` atualizado. O artigo já foi enviado: se o protótipo divergir, precisamos saber explicar.
- [ ] **GRP-04 (P1)** Roteiro da apresentação e plano B em vídeo gravado (a demo depende de internet por causa do modelo na nuvem).
- [ ] **GRP-05 (P0)** Criar `Dockerfile` do front, do back e o `docker-compose.yml`, seguindo `docs/docker.md`. Responsável: [DEFINIR — quem tiver mais familiaridade com Docker]. Só dá para fechar quando cada serviço tiver o seu `package.json`.
- [ ] **GRP-06 (P0)** Isadora e Aguiar: preencher o "Modo de trabalho" no `CLAUDE.md` da sua pasta.

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
- RF-B8: expor as rotas e orquestrar pipeline → IA → segurança.

**Requisitos não funcionais**
- RNF-B1: o modelo nunca decide classificação nem alerta.
- RNF-B2: só laudos sintéticos.
- RNF-B3: cada etapa testável isoladamente.
- RNF-B4: limites críticos com fonte citável.
- RNF-B5: chaves de API fora do repositório (`.env`).

**Tarefas**
- [ ] **BWL-01 (P0)** Laudos sintéticos em PDF (Word ou IA, exportados), com paciente FICTÍCIO, em `samples/laudos/`. Para cada exame: normal, acima e abaixo da faixa (tabela abaixo). Mais uma versão "foto" (imagem) para o OCR.
- [ ] **BWL-02 (P0)** Extração de texto do PDF digital, testada isolada.
- [ ] **BWL-03 (P0)** Estruturação por analito (nome, valor, unidade, faixa), testada isolada. Atenção a vírgula decimal.
- [ ] **BWL-04 (P0)** Normalizar o nome do exame para o `id_canonico` (usa `nomes_alternativos` da base).
- [ ] **BWL-05 (P0)** Regras de classificação + limites críticos por analito, **cada limite com fonte**. Se um exame não tem limite crítico definido (ex.: colesterol), documentar isso.
- [ ] **BWL-06 (P0)** Confiança da extração e erro "envie novamente".
- [ ] **BWL-07 (P0)** Pseudonimização, com teste que prove que nenhum identificador sai.
- [ ] **BWL-08 (P0)** Camada de segurança com as verificações, testada com `samples/respostas-ia/` e casos novos.
- [ ] **BWL-09 (P0)** Orquestrador e rotas do contrato.
- [ ] **BWL-10 (P1)** OCR com Tesseract.js. Se apertar, é o primeiro corte — mas o artigo descreve OCR, então avise o grupo cedo.
- [ ] **BWL-11 (P2)** Lembrete de medicação.

---

## ISA — Isadora: IA

**Requisitos funcionais**
- RF-I1: gerar a explicação sempre nas 5 partes e na ordem: (1) o que o exame avalia; (2) valor e posição na faixa; (3) significado sem afirmar doença; (4) especialidade; (5) aviso.
- RF-I2: buscar a ficha do exame na base e injetá-la no prompt (RAG); em divergência, a base prevalece.
- RF-I3: responder no chat apenas sobre o exame da sessão, sem memória entre sessões.
- RF-I4: aceitar a reprovação da segurança e regenerar.

**Requisitos não funcionais**
- RNF-I1: nunca diagnosticar, indicar/ajustar medicamento nem dar veredito de tranquilidade ou preocupação. Linguagem de "merece atenção"; sem a palavra "preocupante".
- RNF-I2: o modelo só recebe dados estruturados e pseudonimizados.
- RNF-I3: prompt versionado e documentado.
- RNF-I4: resposta em tempo aceitável para a demo.

**Tarefas**
- [ ] **ISA-01 (P0)** Acesso ao modelo (Ollama Cloud, `gpt-oss`) com uma chamada simples isolada. Verificar se o modelo está disponível na conta e quais são os limites do plano gratuito.
- [ ] **ISA-02 (P0)** Prompt de instruções com as 5 partes e as proibições (`ia/prompts/v1`).
- [ ] **ISA-03 (P0)** Busca na base por `id_canonico` e montagem do prompt.
- [ ] **ISA-04 (P0)** Função "analito estruturado → 5 partes", testada com os JSONs de `samples/`.
- [ ] **ISA-05 (P1)** Chat sobre o exame da sessão.
- [ ] **ISA-06 (P1)** Fluxo de regeneração quando a segurança reprova.
- [ ] **ISA-07 (P2)** Redação do tom do lembrete (horários e doses nunca vêm do modelo).

---

## MAG — Aguiar: front e base de conhecimento

> A ligação front↔back está **em aberto** (ver "Decisões em aberto" no contrato).

**Requisitos funcionais**
- RF-A1: tela de envio de laudo (PDF/foto).
- RF-A2: cartão do resultado: analito, valor, faixa, status verde/amarelo/vermelho, explicação em 5 partes, especialidade e aviso.
- RF-A3: estado "não consegui ler, envie de novo".
- RF-A4: destaque visual para alerta de atendimento prioritário.
- RF-A5: chat sobre o exame.

**Requisitos não funcionais**
- RNF-A1: linguagem simples.
- RNF-A2: não depender só de cor (também texto/ícone), por causa de daltonismo.
- RNF-A3: aviso "não substitui avaliação médica" sempre visível.
- RNF-A4: funcionar com os JSONs de `samples/` antes de o back existir.

**Tarefas — front**
- [ ] **MAG-01 (P0)** Telas de envio e cartão, usando os JSONs de `samples/`.
- [ ] **MAG-02 (P0)** Estados de erro (um por código do contrato) e alerta crítico.
- [ ] **MAG-03 (P1)** Ligar ao back real (sujeito à decisão em aberto).
- [ ] **MAG-04 (P1)** Chat.

**Tarefas — base de conhecimento**
- [ ] **MAG-05 (P0)** Com o grupo, confirmar a lista de exames e os nomes como aparecem nos laudos de `samples/laudos/`.
- [ ] **MAG-06 (P0)** Ficha de `glicose` (já há um texto-modelo: leia, confira a fonte, ajuste).
- [ ] **MAG-07 (P0)** Fichas de `colesterol_total`, `creatinina` e `tsh`.
- [ ] **MAG-08 (P0)** Conferir as fontes e pedir revisão do texto a alguém. O artigo prevê revisão por profissionais de saúde como trabalho futuro, ou seja, **ainda não houve**: não afirmar que foi validado.
- [ ] **MAG-09 (P0)** Validar o `exames.json` (JSON sem erro) e marcar `status: "pronto"` em cada ficha concluída.

### Aguiar, leia: o que é a base de conhecimento
O modelo de IA já sabe, em geral, o que é glicose. A base **não é para ensinar isso a ele**. Ela serve para: (1) o sistema dizer sempre a mesma coisa sobre cada exame; (2) a camada de segurança ter com o que comparar (se o modelo citar uma especialidade diferente da base, a resposta é barrada); (3) cada informação ter fonte registrada. Se o modelo "achar" algo diferente, **a base vence**.

Você escreve **uma ficha por exame** em `docs/base-conhecimento/exames.json`, com: nomes alternativos (como o exame aparece nos laudos), o que o exame avalia (1 a 3 frases, linguagem simples), **uma** especialidade, a fonte e o status. **Não escreva** valores de referência (vêm do laudo), diagnóstico, remédio ou palavras como "preocupante". Instruções completas e exemplos de nomes em `docs/base-conhecimento/README.md`.

### Exames do protótipo (proposta — GRP-02)
| `id_canonico` | Nomes que costumam aparecer | Unidade | Faixa de exemplo* | Especialidade sugerida |
|---|---|---|---|---|
| `glicose` | Glicose, Glicemia, Glicemia de jejum | mg/dL | 70 a 99 | Endocrinologia |
| `colesterol_total` | Colesterol total | mg/dL | abaixo de 190 | Cardiologia |
| `creatinina` | Creatinina, Creatinina sérica | mg/dL | 0,6 a 1,3 (varia por sexo) | Nefrologia |
| `tsh` | TSH, TSH ultrassensível | mUI/L | 0,4 a 4,0 | Endocrinologia |

\* Só para entender a ordem de grandeza e criar os laudos. Cada laboratório define a sua faixa; o sistema sempre usa a do laudo. Especialidade sugerida é ponto de partida: confira na fonte.

### Valores sugeridos para os laudos sintéticos (BWL-01)
| Exame | Normal | Acima | Abaixo |
|---|---|---|---|
| `glicose` (mg/dL) | 88 | 118 | 62 (e 42 para o caso crítico ilustrativo) |
| `colesterol_total` (mg/dL) | 165 | 245 | — (não se aplica) |
| `creatinina` (mg/dL) | 0,9 | 1,8 | 0,3 |
| `tsh` (mUI/L) | 2,1 | 8,5 | 0,1 |

Valores **fictícios**. Os limites críticos reais precisam de fonte (BWL-05); por isso só a glicose tem um caso crítico ilustrativo em `samples/`.
