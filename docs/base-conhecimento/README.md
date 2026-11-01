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

## Os exames a fazer (proposta, a confirmar no grupo — GRP-02)
| `id_canonico` | Nomes que costumam aparecer | Unidade | Faixa de exemplo* | Especialidade sugerida |
|---|---|---|---|---|
| `glicose` | Glicose, Glicemia, Glicemia de jejum | mg/dL | 70 a 99 | Endocrinologia |
| `colesterol_total` | Colesterol total | mg/dL | abaixo de 190 | Cardiologia |
| `creatinina` | Creatinina, Creatinina sérica | mg/dL | 0,6 a 1,3 (varia por sexo) | Nefrologia |
| `tsh` | TSH, TSH ultrassensível | mUI/L | 0,4 a 4,0 | Endocrinologia |

\* Faixas só para você entender a ordem de grandeza e para criar os laudos de teste. Cada laboratório define a sua; **o sistema sempre usa a faixa que está no laudo**. A especialidade sugerida é um ponto de partida: confira na fonte e ajuste se necessário.

## Antes de commitar
O arquivo é JSON: **uma vírgula ou aspas faltando quebra o arquivo inteiro**. Peça ao Claude Code para validar o `exames.json` antes de cada commit.
A ficha de glicose já vem com um texto-modelo (status `pendente`): leia, confira a fonte, ajuste e só então marque `pronto`.
