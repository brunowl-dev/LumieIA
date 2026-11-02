# Limites críticos (BWL-05)

Valor crítico é um valor tão fora do esperado que o laboratório deve **comunicar imediatamente** ao médico. No Lumie, ele aciona o **alerta de atendimento prioritário** (cor vermelha, contrato §5.1). Quem decide é uma regra no código (`backend/src/pipeline/classificar.js`), nunca o modelo de linguagem.

- Os números ficam em `backend/src/pipeline/limitesCriticos.json`, separados da lógica, **cada um com a sua fonte** e com o trecho da fonte copiado ao lado.
- Regra: **limite sem fonte citável não entra.** Se um dia faltar a fonte, o campo `fonte` recebe `"fonte_pendente"` e o sistema **desliga** o alerta daquele exame (motivo `fonte_pendente`), em vez de usar um número sem origem.

## Fonte usada

Programa Nacional de Controle de Qualidade (PNCQ). *Valores críticos de exames laboratoriais que necessitam de imediata tomada de decisão, em atendimento à RDC 302:2005 da ANVISA.* Tabela 1: valores quantitativos em sangue de adultos e crianças. Atualizado em novembro/2019. https://pncq.org.br/uploads/2019/Valores%20cr%A1ticos%20no%20laborat%A2rio%20cl%A1nico_nov2019.pdf (acesso em 01/11/2026; o PDF foi lido no original e os trechos abaixo foram copiados dele).

O próprio documento cita como referências: eJIFCC vol. 14 nº 1; Wallach, *Interpretação de Exames Laboratoriais*, 7ª ed. (2003); CLR 2018-2019; SBEM.

## Valores

| `id_canonico` | Crítico se | Unidade | Trecho da fonte | População |
|---|---|---|---|---|
| `glicose` | `< 45` ou `> 450` | mg/dL | "Glicose Adultos: < 45 mg/dL (2,5 mmol/L) > 450 mg/dL (25 mmol/L)" | adultos |
| `creatinina` | `> 7,4` (sem limite inferior) | mg/dL | "Creatinina > 7,4 mg/dL" | adultos e crianças (Tabela 1) |
| `hemoglobina` | `< 6,6` ou `> 19,9` | g/dL | "Hemoglobina < 6,6 g/dL > 19,9 g/dL" | adultos e crianças (Tabela 1) |
| `tsh` | **sem limite crítico** | — | A tabela não tem linha para TSH (só T4 livre e T3 total) | — |
| `colesterol_total` | **sem limite crítico** | — | A tabela não tem linha para colesterol | — |

**Comparação estrita, como está impresso na fonte:** "< 45" não inclui o 45; "> 450" não inclui o 450. Testes de fronteira em `backend/test/pipeline/classificar.test.js`.

## Exames sem limite crítico (TSH e colesterol total)

`limite_critico: null` no arquivo, com `sem_limite_critico.motivo` explicando o porquê. O carregamento **recusa** um exame sem limite e sem motivo. Para esses exames o sistema **nunca** gera alerta crítico: o resultado é classificado normalmente pela faixa do laudo (acima/abaixo → amarelo) e a saída traz `limite_critico.motivo: "sem_limite_definido"`.

## Quando o limite não é avaliado

A saída de cada analito traz `limite_critico.avaliado` e `limite_critico.motivo`:

| `motivo` | Quando | Alerta |
|---|---|---|
| `null` (avaliado) | exame com limite, mesma unidade, valor numérico | conforme o valor |
| `sem_limite_definido` | TSH, colesterol total | nunca |
| `exame_nao_reconhecido` | nome fora da base (`id_canonico: null`) | nunca |
| `unidade_diferente` | ex.: glicose em mmol/L. **O sistema não converte unidades**: um fator errado esconderia ou inventaria um alerta | não avaliado; o item leva o aviso `unidade_diferente_da_esperada` |
| `fonte_pendente` | limite cadastrado sem fonte | nunca |
| `valor_invalido` | valor não numérico (não deveria chegar aqui: a BWL-06 barra antes) | nunca |

## Limitações (para a banca)

- **Os limites são de adultos.** A mesma fonte tem limites diferentes para recém-nascidos (Tabela 2). O protótipo não usa idade, porque ela é dado do paciente e não sai do pipeline.
- **Cada laboratório define a própria lista de valores críticos.** O PNCQ é uma referência nacional de controle de qualidade, não a lista de um laboratório específico. A faixa de referência vem sempre do laudo; o limite crítico, desta configuração.
- O documento é de 2019 e cita a RDC 302:2005; confirmar se a norma citada continua vigente antes de afirmar isso à banca.
- Nenhum profissional de saúde revisou estes números para o projeto: foram copiados da fonte.
