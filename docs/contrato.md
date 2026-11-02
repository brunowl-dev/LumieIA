# Contrato de dados — Lumie (módulo de IA)

> Rascunho gerado pelo Claude a partir do plano do grupo. **Precisa ser lido e aprovado pelos três antes de cada um começar** (tarefa GRP-01).
> Itens marcados **[A CONFIRMAR]** são suposições minhas que o grupo deve validar.
>
> **Congelado em:** [PREENCHER data/hora]
> **Aprovado por:** [ ] Bruno (BWL) · [ ] Isadora (ISA) · [ ] Aguiar (MAG)
>
> Regra: mudou algo aqui? Atualize este arquivo na mesma branch e avise os outros dois.

## 0. Convenções
- Formato: JSON. Nomes de campos em português, `snake_case`. Números como número (ponto decimal no JSON). Textos em UTF-8.
- Nenhum dado que identifique o paciente trafega a partir do pipeline (nem para o modelo, nem para o front, nem para logs).
- Exemplos reais de cada formato estão em `samples/`. Em caso de dúvida, o exemplo vale mais do que a descrição.

## 1. Visão do fluxo

O fluxo tem três momentos. A IA **só entra quando o paciente pede** a explicação de um exame.

```
MOMENTO 1 — enviar o laudo (sem IA)
Front ──(arquivo)──> POST /api/laudos ──> PIPELINE ──> laudo estruturado (guardado na sessão)
Front <──(tela de exames: valor, faixa, cor, alerta)── orquestrador

MOMENTO 2 — paciente clica "Explicar com IA" em UM exame → abre o chat daquele exame
Front ──(id_laudo, id_canonico)──> POST /api/explicacoes ──> orquestrador
        orquestrador: analito da sessão + ficha da BASE ──> IA ──> SEGURANÇA
                      reprovou → volta à IA com o motivo (até MAX_REGENERACOES)
                      esgotou  → mensagem padrão (montada sem o modelo)
Front <──(1ª mensagem do chat: explicação em 5 partes)── orquestrador

MOMENTO 3 — paciente digita dúvidas no chat daquele exame
Front ──(id_laudo, id_canonico, mensagem)──> POST /api/chat ──> IA ──> SEGURANÇA ──> resposta
```

- A tela de exames (momento 1) já mostra classificação, cor e **alerta prioritário**: tudo vem do pipeline, por regra determinística. O alerta crítico nunca depende do modelo nem do clique no botão.
- Um botão por exame. Cada chat é sobre **um** exame (um `id_canonico`) do laudo enviado.
- O orquestrador (`backend/src/api`) é o único que chama pipeline, IA e segurança, e é ele quem faz o laço de regeneração.

## 2. Pipeline → orquestrador: "laudo estruturado"
- **Produz:** pipeline (BWL). **Consome:** orquestrador (BWL), que guarda na sessão e repassa à IA um analito por vez.

| Campo | Tipo | Descrição |
|---|---|---|
| `id_laudo` | texto | Identificador gerado pelo sistema, sem relação com o paciente |
| `origem` | `"pdf_digital"` \| `"ocr"` | Como o texto foi obtido |
| `confianca_extracao` | número 0–1 | Confiança geral da extração |
| `analitos` | lista | Um item por exame encontrado (abaixo) |

Cada item de `analitos`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id_canonico` | texto \| null | Identificador da base (ex.: `glicose`). `null` se não encontrado na base |
| `nome_no_laudo` | texto | Como o exame aparece escrito no laudo |
| `valor` | número | Valor obtido |
| `unidade` | texto | Ex.: `mg/dL` |
| `faixa_referencia` | objeto | `minimo` (número ou null), `maximo` (número ou null), `minimo_inclusivo` / `maximo_inclusivo` (verdadeiro/falso, null se não há aquele limite; "Inferior a 190" → `maximo_inclusivo: false`; "Até 150" → `true`; "70 a 99" → ambos `true`), `texto_original` (como está no laudo) |
| `classificacao` | `"dentro"` \| `"acima"` \| `"abaixo"` | Decidida por regra determinística, SEMPRE com a faixa do laudo |
| `alerta_critico` | verdadeiro/falso | Decidido por limite crítico por analito (com fonte) |
| `confianca` | número 0–1 | Confiança da extração deste item |

**Não existe aqui:** nome do paciente, CPF, data de nascimento, endereço, número do pedido, texto bruto do laudo.

- Um mesmo `id_canonico` aparece **no máximo uma vez** por laudo: ele é a chave usada para pedir a explicação e o chat.
- Analito sem ficha na base (`id_canonico: null`): ainda é classificado (a faixa vem do laudo), mas `alerta_critico` é sempre `false`, porque os limites críticos são por `id_canonico`. Ele aparece na tela de exames **sem** botão de explicação (seção 5.1).

**Falhas:** arquivo ilegível ou confiança abaixo do mínimo → o pipeline não devolve laudo; devolve erro (seção 7).

### 2.1 Etapa interna: extração de texto do PDF digital (BWL-02)
Uso interno do pipeline; não sai para o front nem para o modelo. `backend/src/pipeline/extrairTextoPdf.js`:

`extrairTextoPdf(buffer, { senha? })` → `{ texto, numPaginas, caracteresUteis, temCamadaDeTexto }`

| Campo | Tipo | Descrição |
|---|---|---|
| `texto` | texto | Texto do PDF (pdf-parse v2), quebras de linha normalizadas para `\n`, sem outra limpeza. Contém dados do paciente: nunca registrar em log nem enviar ao modelo |
| `numPaginas` | número | Páginas do PDF |
| `caracteresUteis` | número | Caracteres não-espaço de `texto` |
| `temCamadaDeTexto` | verdadeiro/falso | `false` se `caracteresUteis` < `LIMIAR_CARACTERES_UTEIS` (50): PDF só de imagem, candidato ao OCR |

Erros: `ErroExtracaoPdf` com `codigo` estável. São códigos **internos**; o orquestrador traduz para a seção 7.

| `codigo` | Quando | Tradução sugerida (seção 7) |
|---|---|---|
| `ARQUIVO_VAZIO` | 0 bytes | `ARQUIVO_ILEGIVEL` |
| `ARQUIVO_NAO_E_PDF` | sem `%PDF-` nos primeiros 1024 bytes (JPG, bytes aleatórios) | imagem → OCR; senão `FORMATO_NAO_SUPORTADO` |
| `PDF_CORROMPIDO` | o pdf-parse não consegue ler (ex.: arquivo truncado) | `ARQUIVO_ILEGIVEL` |
| `PDF_PROTEGIDO` | PDF com senha e nenhuma senha informada | **[A CONFIRMAR no grupo]** pedir a senha |
| `SENHA_INCORRETA` | senha informada não abre o PDF | **[A CONFIRMAR no grupo]** pedir a senha de novo |

PDF com senha (proposta, depende de mudança na seção 7, na porta 1 e no front): o sistema pede a senha com mensagem FIXA ("Mande uma mensagem apenas contendo a senha do documento."), sem o modelo. A senha só abre o arquivo em memória: nunca vai para o modelo, log ou sessão.

### 2.2 Etapa interna: estruturação por analito (BWL-03)
Uso interno do pipeline; não sai para o front nem para o modelo. `backend/src/pipeline/estruturarAnalitos.js`:

`estruturarAnalitos(texto)` → `{ analitos, nao_interpretadas }`. Função pura (sem rede, sem modelo, sem log). Só lê o que está impresso: não classifica (BWL-05) nem normaliza o nome (BWL-04).

Cada item de `analitos` já usa os nomes da seção 2; as etapas seguintes acrescentam `id_canonico`, `classificacao` e `alerta_critico`.

| Campo | Tipo | Descrição |
|---|---|---|
| `nome_no_laudo` | texto | Como está no laudo, só juntando espaços (Layout B vem em maiúsculas: "GLICOSE EM JEJUM") |
| `valor` | número | Vírgula é decimal, ponto é milhar ("1.234,5" → 1234.5; "5.000" → 5000). Ponto sem grupos de 3 dígitos é tratado como decimal ("4.5" → 4.5) |
| `valor_impresso` | texto | O valor como impresso, para auditoria |
| `unidade` | texto \| null | Token com `/` ou `%` logo após o valor (`mg/dL`, `µUI/mL`), como impresso |
| `faixa_referencia` | objeto | Seção 2 + `interpretada` (verdadeiro/falso). Formato não reconhecido → `interpretada: false`, limites `null`, `texto_original` preservado |
| `outras_faixas` | lista de texto | Quando o laudo traz várias categorias ("Normal", "Glicemia de jejum alterada", "Diabetes"): a faixa usada é a "Normal"; as demais ficam aqui, como texto. Senão, `[]` |
| `confianca` | número 0–1 | Campos encontrados / 4 (nome, valor, unidade, faixa interpretada) |
| `pendencias` | lista | `unidade_ausente`, `faixa_ausente`, `faixa_nao_interpretada` |

`nao_interpretadas`: `[{ linha, motivo }]`, linhas que parecem resultado mas não viraram analito. Nunca são descartadas em silêncio. Motivos: `formato_nao_reconhecido`, `valor_invalido`, `valor_ausente`, `valor_com_sinal` ("< 0,5": limite de detecção não é o valor 0,5), `nome_nao_encontrado`, `unidade_e_faixa_ausentes`. **Contém texto do laudo:** mesma regra do `texto` da seção 2.1 (nunca para log, front ou modelo).

A decisão "baixa confiança → pedir novo envio" (seção 7, `BAIXA_CONFIANCA`) é da BWL-06, a partir de `confianca`, `pendencias` e `nao_interpretadas`.

## 3. Base de conhecimento → IA e Segurança
- **Produz:** Aguiar (MAG), em `docs/base-conhecimento/exames.json`. **Consome:** IA (para o prompt) e Segurança (para conferir a especialidade) e Pipeline (para reconhecer o nome do exame).

Cada ficha: `id_canonico`, `nomes_alternativos` (lista), `o_que_avalia` (texto simples), `especialidade` (UMA), `fonte`, `status` (`"pronto"` ou `"pendente"`).
Só fichas com `status: "pronto"` são usadas. O carregamento deve validar o arquivo e falhar com mensagem clara se estiver malformado.
**Falha:** exame sem ficha `pronto` → tratado como sem ficha (`id_canonico: null` no pipeline; sem botão de explicação).

## 4. IA → Segurança
- **Produz:** IA (ISA). **Consome:** Segurança (BWL), chamada pelo orquestrador.
- **Entrada da IA:** UM analito do laudo estruturado + a ficha dele na base (+ no chat: o histórico da conversa daquele exame e a nova mensagem). Nunca o texto bruto do laudo.

**4.1 Explicação (momento 2).** Um objeto com as 5 partes, em campos separados e nesta ordem:
`o_que_avalia`, `valor_e_posicao`, `significado`, `especialidade`, `aviso`. Exemplos em `samples/respostas-ia/`.

**4.2 Resposta do chat (momento 3).** `{ "resposta": "texto" }`, terminando com o aviso (seção 9).

- A IA só explica; nunca altera `classificacao` nem `alerta_critico`.
- Proibido: diagnóstico, indicação/ajuste de medicamento, veredito de tranquilidade ou preocupação, a palavra "preocupante". Use "merece atenção".
- Numa nova tentativa, a IA recebe o motivo da reprovação anterior (para corrigir), mas **não** decide quantas vezes tentar: isso é do orquestrador.
- **Falha:** modelo indisponível ou lento → erro `MODELO_INDISPONIVEL` (seção 7).

## 5. Orquestrador → Front
- **Produz:** orquestrador (BWL). **Consome:** Front (MAG). Exemplos em `samples/respostas-api/`.

### 5.1 Resultado do laudo (resposta de `POST /api/laudos`) — a tela de exames

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `"ok"` | |
| `id_laudo` | texto | Usado para pedir a explicação e no chat |
| `itens` | lista | Um item por analito |

Cada item: `id_canonico` (texto ou null), `nome`, `valor`, `unidade`, `faixa_referencia`, `classificacao`, `cor`, `alerta_prioritario`, `explicacao_disponivel` (verdadeiro/falso).
- `explicacao_disponivel: false` quando o exame não tem ficha na base: o front mostra o valor e a classificação, sem o botão, com o texto "ainda não temos explicação para este exame".

**Cores:** `verde` = `dentro`; `amarelo` = `acima` ou `abaixo` sem alerta crítico; `vermelho` = `alerta_critico` verdadeiro (alerta de atendimento prioritário).
O front nunca decide status: a cor e o alerta chegam prontos.

### 5.2 Explicação (resposta de `POST /api/explicacoes`) — 1ª mensagem do chat

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `"ok"` | |
| `id_laudo` | texto | |
| `id_canonico` | texto | |
| `explicacao` | objeto | As 5 partes da seção 4.1 |
| `origem_texto` | `"modelo"` \| `"mensagem_padrao"` | |
| `tentativas_regeneracao` | número | Quantas vezes a segurança reprovou antes desta resposta |

### 5.3 Resposta do chat (resposta de `POST /api/chat`)

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `"ok"` | |
| `resposta` | texto | Já aprovada pela segurança, com o aviso |
| `origem_texto` | `"modelo"` \| `"mensagem_padrao"` | |

## 6. Portas HTTP
| Porta | Método e caminho | Entrada | Saída |
|---|---|---|---|
| 1. Enviar laudo | `POST /api/laudos` (multipart) | arquivo PDF ou imagem | 5.1 ou erro |
| 2. Explicar exame | `POST /api/explicacoes` | `id_laudo`, `id_canonico` | 5.2 ou erro |
| 3. Chat do exame | `POST /api/chat` | `id_laudo`, `id_canonico`, `mensagem` | 5.3 ou erro |
| Técnica | `GET /api/saude` | — | `{"status":"ok"}` (healthcheck do Docker) |

**Chat:** responde só sobre aquele exame (analito da sessão + ficha da base). O histórico da conversa de cada exame fica na sessão em memória e some junto com ela (`SESSION_TTL_MINUTES`); não há memória entre sessões. Pergunta fora do exame → a resposta recusa com educação e indica a especialidade da base. Passa pela segurança (seção 8). A explicação em 5 partes está no artigo; as perguntas livres no chat são extensão do protótipo (ver `artigo-vs-prototipo.md`).
**Lembretes:** horários e doses vêm sempre dos dados cadastrados; o modelo só redige o tom.

## 7. Erros
Formato: `{"status":"erro","erro":{"codigo":"...","mensagem_usuario":"..."}}`. `mensagem_usuario` é em linguagem simples, pronta para exibir.

| Código | Porta | Quando | O que o front faz |
|---|---|---|---|
| `FORMATO_NAO_SUPORTADO` | 1 | arquivo que não é PDF/imagem | pedir outro arquivo |
| `ARQUIVO_MUITO_GRANDE` | 1 | acima de `UPLOAD_MAX_MB` | pedir arquivo menor |
| `ARQUIVO_ILEGIVEL` | 1 | não foi possível extrair texto | pedir novo envio (foto mais nítida) |
| `BAIXA_CONFIANCA` | 1 | extração abaixo do mínimo | pedir novo envio |
| `EXAME_NAO_ENCONTRADO` | 2, 3 | `id_canonico` que não está no laudo ou não tem ficha (o front não deveria chamar, pois o botão não aparece) | voltar à tela de exames |
| `MODELO_INDISPONIVEL` | 2, 3 | modelo fora do ar ou sem resposta dentro de `OLLAMA_TIMEOUT_MS` | usar mensagem padrão: "Estamos indisponíveis no momento" |
| `SESSAO_EXPIRADA` | 2, 3 | `id_laudo` expirado | pedir novo envio do laudo |

Ausência de ficha **não** é erro da porta 1: o laudo volta com `status: "ok"` e o item com `explicacao_disponivel: false`.

## 8. Regras de segurança (resumo; detalhes em `backend/src/seguranca/CLAUDE.md`)
- **Explicação (4.1):** 1. Aviso presente. 2. Especialidade igual à da base. 3. Sem termos de diagnóstico, prescrição ou veredito. (P1: 5 partes completas e em ordem.)
- **Chat (4.2):** 1. Aviso presente. 3. Sem termos de diagnóstico, prescrição ou veredito.
- A segurança só **avalia**: devolve aprovado/reprovado + motivo. Ela não chama a IA.
- Quem faz o laço é o **orquestrador**: reprovou → pede nova resposta à IA (com o motivo), até `MAX_REGENERACOES`. Esgotou → **mensagem padrão**, montada sem o modelo, e `origem_texto` passa a `"mensagem_padrao"`:
  - explicação: finalidade e especialidade da base + valor e posição do pipeline + aviso fixo;
  - chat: "Não consegui responder essa dúvida com segurança. Converse com um profissional de saúde." + especialidade da base + aviso fixo.

## 9. Aviso padrão
Texto de referência: "Esta explicação é informativa e não substitui a avaliação de um profissional de saúde."
A IA deve incluí-lo na parte 5 (explicação) e ao fim de cada resposta do chat; a segurança confere pelo sentido ("não substitui" + avaliação profissional), não pela cópia exata.

## 10. Decisões em aberto
- [ ] Quem faz a ligação front↔back: a Aguiar também orquestra o back, ou só liga o front às portas? (Sugestão: só liga o front às portas; o orquestrador fica com o Bruno.)
- [ ] As portas e o comportamento do chat (seção 6).
- [ ] Mapeamento de cores (seção 5.1).
- [ ] `MODELO_INDISPONIVEL`: erro ou mensagem padrão?
- [x] Lista final de exames (GRP-02): `glicose`, `colesterol_total`, `creatinina`, `tsh`, `hemoglobina`.
- [ ] Texto final do aviso padrão e da mensagem padrão do chat.
