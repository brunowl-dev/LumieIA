# samples/laudos/ — laudos sintéticos (BWL-01)

**Tudo aqui é FICTÍCIO** (LGPD): paciente "Maria Teste da Silva" (F, 34 anos, nasc. 14/03/1992, CPF 000.000.000-00), "Laboratório Modelo Lumie (fictício)", médico e responsáveis inventados, sem CRM real. Cada laudo traz no rodapé "DOCUMENTO SINTÉTICO, USO EM TESTES".

**As faixas de referência são ILUSTRATIVAS.** Servem para testar o parser; não são referência clínica. Num laudo real a faixa é a do próprio laboratório, e o sistema sempre usa a faixa impressa no laudo.

## Arquivos
| Arquivo | O que testa |
|---|---|
| `<exame>_<normal\|acima\|abaixo>.pdf` | PDF digital, Layout A (tabela Exame \| Resultado \| Unidade \| Valores de referência), um exame por arquivo. Glicose, hemoglobina, TSH, colesterol total e creatinina. |
| `colesterol_total_*.pdf` | Faixa unilateral ("Inferior a 190"). Não há variante "abaixo". |
| `glicose_critico_alto.pdf` (486) / `glicose_critico_baixo.pdf` (38) | Casos para o alerta prioritário (BWL-05). Os limites críticos não estão no laudo: vêm da configuração com fonte. |
| `glicose_limite.pdf` (99) / `colesterol_total_limite.pdf` (190) | Valor exatamente na fronteira. "70 a 99" é inclusivo → 99 é **dentro**; "Inferior a 190" exclui o 190 → **acima**. Regra completa em `backend/src/pipeline/CLAUDE.md`. |
| `glicose_acima_layoutB.pdf` | Layout B: blocos de texto ("Resultado: 118 mg/dL" / "Valor de referência: 70 a 99 mg/dL"), com cabeçalho, fonte e rodapé diferentes. |
| `painel_misto_layoutA.pdf` / `painel_misto_layoutB.pdf` | Os 4 exames no mesmo laudo (glicose 118, hemoglobina 13,8, TSH 7,80, colesterol total 172). |
| `foto_glicose_acima.jpg` | Foto simulada de `glicose_acima.pdf` (rotação, sombra, ruído, JPEG). Legível. Para OCR. |
| `foto_painel_misto.jpg` | Foto simulada de `painel_misto_layoutA.pdf`. Legível. Para OCR. |
| `foto_borrada.jpg` | Foto de `glicose_acima.pdf` com desfoque forte, de propósito: deve cair em "baixa confiança, envie novamente". |
| `gabarito.json` | Resposta esperada para cada arquivo. |

## Detalhes que o parser precisa tratar
- Vírgula decimal como impressa: `13,8`, `0,45`, `7,80`.
- No Layout A a unidade fica em coluna própria e a faixa vem sem unidade (`70 a 99`); no Layout B a faixa vem com unidade (`70 a 99 mg/dL`).
- A unidade do TSH usa o caractere `µ` U+00B5 (MICRO SIGN): `µUI/mL`. OCR pode devolver `u` ou `μ` (U+03BC).
- Os PDFs digitais têm camada de texto (testado com `pdftotext`); as fotos não têm, só imagem.

## Como o gabarito é usado
`gabarito.json` é a fonte da verdade de BWL-02 (extração) e BWL-03 (estruturação). Para cada arquivo (`arquivo`, `layout`, `tipo`) há a lista `analitos` com `nome`, `valor` (número), `valor_impresso` (texto exato), `unidade`, `faixa_impressa` (texto exato), `classificacao_esperada` e `critico`. As fotos têm `gerado_de` (PDF de origem). `esperado_baixa_confianca` é `true` só em `foto_borrada.jpg`; nela, os `analitos` descrevem o que está no PDF de origem, mas o esperado é o pipeline **não** devolver valores.

Os testes comparam a saída do pipeline com estas entradas. `classificacao_esperada` e `critico` servem para BWL-05; quem decide isso no sistema é a regra no código, nunca o gabarito nem o modelo.

Os arquivos foram gerados por um script fora do repositório (decisão do grupo: não manter gerador aqui). Se precisar mudar um laudo, mude também o gabarito e confira de novo.
