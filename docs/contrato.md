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

```
Front ──(arquivo)──> API/orquestrador ──> PIPELINE ──> laudo estruturado ──┐
                                                                            ▼
                           BASE DE CONHECIMENTO ──────────────────────>   IA (modelo)
                                                                            │ texto em 5 partes, por analito
                                                                            ▼
Front <──(cartão)── API/orquestrador <────────────────────────────────  SEGURANÇA
                                                (aprova, pede regeneração ou usa mensagem padrão)
```

## 2. Pipeline → IA: "laudo estruturado"
- **Produz:** pipeline (BWL). **Consome:** IA (ISA), via orquestrador (BWL).

| Campo | Tipo | Descrição |
|---|---|---|
| `id_laudo` | texto | Identificador gerado pelo sistema, sem relação com o paciente |
| `origem` | `"pdf_digital"` \| `"ocr"` | Como o texto foi obtido |
| `confianca_extracao` | número 0–1 | Confiança geral da extração |
| `analitos` | lista | Um item por exame encontrado (abaixo) |

Cada item de `analitos`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id_canonico` | texto \| null | Identificador da base (ex.: `glicose`). `null` se não encontrado |
| `nome_no_laudo` | texto | Como o exame aparece escrito no laudo |
| `valor` | número | Valor obtido |
| `unidade` | texto | Ex.: `mg/dL` |
| `faixa_referencia` | objeto | `minimo` (número ou null), `maximo` (número ou null), `texto_original` (como está no laudo) |
| `classificacao` | `"dentro"` \| `"acima"` \| `"abaixo"` | Decidida por regra determinística, SEMPRE com a faixa do laudo |
| `alerta_critico` | verdadeiro/falso | Decidido por limite crítico por analito (com fonte) |
| `confianca` | número 0–1 | Confiança da extração deste item |

**Não existe aqui:** nome do paciente, CPF, data de nascimento, endereço, número do pedido, texto bruto do laudo.

**Falhas:** arquivo ilegível ou confiança abaixo do mínimo → o pipeline não devolve laudo; devolve erro (seção 7). Analito não encontrado na base → item com `id_canonico: null` e o orquestrador trata como `EXAME_NAO_ENCONTRADO`.

## 3. Base de conhecimento → IA e Segurança
- **Produz:** Aguiar (MAG), em `docs/base-conhecimento/exames.json`. **Consome:** IA (para o prompt) e Segurança (para conferir a especialidade) e Pipeline (para reconhecer o nome do exame).

Cada ficha: `id_canonico`, `nomes_alternativos` (lista), `o_que_avalia` (texto simples), `especialidade` (UMA), `fonte`, `status` (`"pronto"` ou `"pendente"`).
Só fichas com `status: "pronto"` são usadas. O carregamento deve validar o arquivo e falhar com mensagem clara se estiver malformado.
**Falha:** exame sem ficha → `EXAME_NAO_ENCONTRADO` para aquele item.

## 4. IA → Segurança: texto por analito
- **Produz:** IA (ISA). **Consome:** Segurança (BWL).

Para cada analito, um objeto com as 5 partes, em campos separados e nesta ordem:
`o_que_avalia`, `valor_e_posicao`, `significado`, `especialidade`, `aviso`.

- A IA só explica; nunca altera `classificacao` nem `alerta_critico`.
- Proibido: diagnóstico, indicação/ajuste de medicamento, veredito de tranquilidade ou preocupação, a palavra "preocupante". Use "merece atenção".
- **Falha:** modelo indisponível ou lento → erro `MODELO_INDISPONIVEL` (seção 7).

## 5. Segurança → Front: o "cartão"
- **Produz:** Segurança/orquestrador (BWL). **Consome:** Front (MAG).

Resposta de sucesso da porta "enviar laudo":

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `"ok"` | |
| `id_laudo` | texto | Usado depois no chat |
| `itens` | lista | Um cartão por analito |

Cada item: `id_canonico`, `nome`, `valor`, `unidade`, `faixa_referencia`, `classificacao`, `cor`, `alerta_prioritario`, `explicacao` (as 5 partes), `origem_texto` (`"modelo"` ou `"mensagem_padrao"`), `tentativas_regeneracao` (número).

**Cores [A CONFIRMAR]:** `verde` = `dentro`; `amarelo` = `acima` ou `abaixo` sem alerta crítico; `vermelho` = `alerta_critico` verdadeiro (alerta de atendimento prioritário).
O front nunca decide status: a cor e o alerta chegam prontos.

## 6. Portas HTTP [A CONFIRMAR as 3 portas]
| Porta | Método e caminho | Entrada | Saída |
|---|---|---|---|
| 1. Enviar laudo | `POST /api/laudos` (multipart) | arquivo PDF ou imagem | cartão (seção 5) ou erro |
| 2. Chat | `POST /api/chat` | `id_laudo`, `mensagem` | `resposta`, `origem_texto` |
| 3. Lembretes (P2) | `POST /api/lembretes` | medicações/consultas cadastradas | lembretes redigidos |
| Técnica | `GET /api/saude` | — | `{"status":"ok"}` (healthcheck do Docker) |

**Chat [A CONFIRMAR]:** responde só sobre o exame da sessão (laudo estruturado em memória + base), sem memória entre sessões, passa pela segurança (sem diagnóstico/prescrição/veredito e com aviso). O artigo NÃO descreve um chat — é extensão do protótipo (ver `artigo-vs-prototipo.md`).
**Lembretes:** horários e doses vêm sempre dos dados cadastrados; o modelo só redige o tom.

## 7. Erros
Formato: `{"status":"erro","erro":{"codigo":"...","mensagem_usuario":"..."}}`. `mensagem_usuario` é em linguagem simples, pronta para exibir.

| Código | Quando | O que o front faz |
|---|---|---|
| `FORMATO_NAO_SUPORTADO` | arquivo que não é PDF/imagem | pedir outro arquivo |
| `ARQUIVO_MUITO_GRANDE` | acima de `UPLOAD_MAX_MB` | pedir arquivo menor |
| `ARQUIVO_ILEGIVEL` | não foi possível extrair texto | pedir novo envio (foto mais nítida) |
| `BAIXA_CONFIANCA` | extração abaixo do mínimo | pedir novo envio |
| `EXAME_NAO_ENCONTRADO` | exame sem ficha na base | mostrar o valor sem explicação e avisar que o exame ainda não é coberto |
| `MODELO_INDISPONIVEL` | modelo fora do ar ou timeout | avisar e permitir tentar de novo [A CONFIRMAR: ou usar mensagem padrão] |
| `SESSAO_EXPIRADA` | chat com `id_laudo` expirado | pedir novo envio do laudo |

## 8. Regras de segurança (resumo; detalhes em `backend/src/seguranca/CLAUDE.md`)
1. Aviso presente. 2. Especialidade igual à da base. 3. Sem termos de diagnóstico, prescrição ou veredito. (P1: 5 partes completas e em ordem.)
- Reprovou → pedir nova resposta à IA, até `MAX_REGENERACOES`. Esgotou → **mensagem padrão**, montada sem o modelo: finalidade e especialidade da base + valor e posição do pipeline + aviso fixo. `origem_texto` passa a `"mensagem_padrao"`.

## 9. Aviso padrão
Texto de referência: "Esta explicação é informativa e não substitui a avaliação de um profissional de saúde."
A IA deve incluí-lo na parte 5; a segurança confere pelo sentido ("não substitui" + avaliação profissional), não pela cópia exata. **[A CONFIRMAR]** o texto final.

## 10. Decisões em aberto
- [ ] Quem faz a ligação front↔back: a Aguiar também orquestra o back, ou só liga o front às portas? (Sugestão: só liga o front às portas; o orquestrador fica com o Bruno.)
- [ ] As 3 portas e o comportamento do chat (seção 6).
- [ ] Mapeamento de cores (seção 5).
- [ ] `MODELO_INDISPONIVEL`: erro ou mensagem padrão?
- [ ] Lista final de exames além da glicose (GRP-02).
- [ ] Texto final do aviso padrão.
