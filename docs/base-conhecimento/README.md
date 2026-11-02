# Base de conhecimento (para a Aguiar)

## O que é e para que serve
O modelo de IA já sabe, de modo geral, o que é glicose. A base **não é para ensinar isso a ele**. Ela serve para três coisas:
1. **Consistência:** o sistema sempre diz a mesma coisa sobre cada exame (e não uma coisa diferente a cada vez).
2. **Conferência:** a camada de segurança compara a especialidade que o modelo citou com a que está aqui. Sem a base, não há com o que comparar.
3. **Fonte:** cada informação tem origem registrada. Em saúde, a banca vai perguntar "de onde veio isso?".

Se o modelo "achar" algo diferente do que está aqui, **a base vence**.

## O que você escreve: uma ficha por exame
Arquivo: `exames.json` (nesta pasta). Cada ficha tem:

| Campo | O que colocar |
|---|---|
| `id_canonico` | Nome curto único, sem acento e sem espaço (ex.: `glicose`). Já está definido; não mude |
| `nomes_alternativos` | Como o exame aparece escrito nos laudos. **Olhe os laudos de `samples/`** e acrescente variações reais. O sistema usa esta lista para reconhecer o exame |
| `o_que_avalia` | 1 a 3 frases, em linguagem simples, como se explicasse a alguém sem formação em saúde |
| `especialidade` | **Uma** especialidade médica (o sistema confere por código) |
| `fonte` | Onde você se baseou (Ministério da Saúde, sociedade médica, etc.) |
| `status` | `"pendente"` enquanto não revisou; mude para `"pronto"` quando terminar e conferir a fonte |

## O que NÃO escrever
- Valores de referência (vêm do próprio laudo de cada laboratório).
- Diagnósticos ("indica diabetes"), remédios ou condutas.
- Palavras como "preocupante", "grave", "normal/anormal" como veredito. Só **o que o exame mede e para que serve**.

## Os exames do protótipo (definidos — GRP-02)
| `id_canonico` | Nome nos laudos de teste | Unidade | Faixa impressa nos laudos de teste* | Especialidade na ficha |
|---|---|---|---|---|
| `glicose` | Glicose em jejum | mg/dL | 70 a 99 | Endocrinologia |
| `colesterol_total` | Colesterol total | mg/dL | Inferior a 190 | Cardiologia |
| `creatinina` | Creatinina | mg/dL | 0,6 a 1,3 | Nefrologia |
| `tsh` | TSH | µUI/mL (= mUI/L) | 0,45 a 4,50 | Endocrinologia |
| `hemoglobina` | Hemoglobina | g/dL | 12,0 a 16,0 | Hematologia |

\* Faixas ILUSTRATIVAS, só para os laudos de teste. Cada laboratório define a sua; **o sistema sempre usa a faixa que está no laudo**.

## Situação das fichas
As cinco fichas já estão preenchidas (pelo Claude): o texto de `o_que_avalia` foi escrito a partir de fontes brasileiras citadas em `fonte` (Ministério da Saúde/BVS, Secretaria de Saúde do DF, Hemoes, SBD e SBEM), consultadas em 01/11/2026. Cada frase do texto foi conferida contra a página. A especialidade foi escolhida pela área que trata o órgão ou sistema avaliado: é **escolha do grupo**, não está na fonte (no TSH, coincide com a sociedade que publica a fonte). Todas estão com `status: "pendente"`:
1. Leia cada ficha, abra o link da fonte e confira se o texto diz o mesmo, em linguagem simples.
2. Confira se a especialidade faz sentido para vocês e saibam justificá-la à banca.
3. Só então mude para `"pronto"`. Ficha `pendente` não é usada na explicação: o exame aparece sem o botão "Explicar com IA". (Os `nomes_alternativos` valem mesmo em ficha `pendente`: o pipeline reconhece o exame e aplica o alerta crítico.)

## Como o sistema usa `nomes_alternativos` (BWL-04)
O pipeline compara o nome do laudo com cada nome da lista **depois de normalizar os dois**: sem acento, sem maiúsculas, pontuação vira espaço, espaços juntados. Ou seja, "GLICOSE (jejum)", "Glicose - jejum" e "glicose jejum" são o mesmo nome; não precisa cadastrar cada variação de maiúscula ou acento.
O que **precisa** cadastrar: palavras diferentes ("Glicemia jejum" ≠ "Glicemia de jejum"). Nada é adivinhado: nome fora da lista vira "exame sem ficha".
Regras que o carregamento confere (e falha com mensagem clara): cada ficha tem `id_canonico` e a lista `nomes_alternativos`; o mesmo nome não pode estar em duas fichas. O próprio `id_canonico` também vale como nome.

A revisão por profissionais de saúde é trabalho futuro do artigo: **não afirme que o texto foi validado**.

## Antes de commitar
O arquivo é JSON: **uma vírgula ou aspas faltando quebra o arquivo inteiro**. Peça ao Claude Code para validar o `exames.json` antes de cada commit.
Se mudar o `o_que_avalia` ou a `especialidade` da glicose, atualize também `samples/respostas-api/explicacao-*.json`, que copiam esses textos.
