# Camada de segurança — verificações (BWL-08)

Código: `backend/src/seguranca/verificarResposta.js` (funções puras), `termosProibidos.json` (listas) e `mensagemPadrao.js`. O laço de regeneração fica em `backend/src/api/gerarComSeguranca.js`.
Testes: `backend/test/seguranca/verificarResposta.test.js`, que roda todos os casos de `samples/respostas-ia/manifesto.json`, e `backend/test/api/gerarComSeguranca.test.js`.

## Como o texto é preparado
1. **Normalização:** sem acento, minúsculas, pontuação vira espaço, espaços juntados ("Você TEM   diabetes!" → "voce tem diabetes").
2. **O aviso é apagado antes da busca, e só o trecho dele.** Um aviso como "não substitui o diagnóstico de um médico" reprovaria toda resposta correta. O resto da frase continua sendo verificado.
3. **Negações permitidas são apagadas antes da busca.** É assim que "não é um diagnóstico" passa. Veredito não tem negação permitida: "não há motivo para preocupação" **é** um veredito.
4. **Palavra inteira:** "dose" não casa dentro de "glicose". Um `*` no fim do termo aceita qualquer final ("diabet*" pega diabetes, diabético, diabética).

## Verificações
| # | Verificação | Código de motivo | Onde | Exemplo que pega | O que NÃO pega |
|---|---|---|---|---|---|
| 0 | As 5 partes presentes e preenchidas (a "ordem" do artigo: cada parte chega em um campo JSON próprio) | `parte_ausente` | explicação, chat | `significado` faltando; `aviso: ""` | Parte preenchida com texto fora do assunto |
| 1 | Aviso presente, pelo sentido: "não substitui" + avaliação/consulta/diagnóstico + profissional/médico | `aviso_ausente` | explicação (parte 5); chat (nas 2 últimas frases) | Resposta sem aviso; no chat, aviso no começo | Aviso com outras palavras ("não dispensa ir ao médico") é reprovado: falso positivo |
| 2 | Especialidade igual à da base | `especialidade_divergente` | explicação (campo); chat (se citar uma) | "Cardiologia" para glicose; "procure um cardiologista" no chat | Especialidade fora da lista do código; "clínico geral" é sempre aceito |
| 3 | Sem diagnóstico | `termo_diagnostico` | ambos | "Você tem diabetes"; "indica que você é diabético"; "VOCE TEM DIABETES" | Diagnóstico sem termo da lista ("seu pâncreas não funciona bem") |
| 4 | Sem prescrição | `termo_prescricao` | ambos | "500 mg de metformina duas vezes ao dia"; "Tome um comprimido" | Remédio fora da lista; "use aquele remédio que você já tem" |
| 5 | Sem veredito de tranquilidade ou preocupação | `termo_veredito` | ambos | "preocupante"; "não precisa se preocupar"; "fique tranquila, está tudo bem" | Veredito com outras palavras ("pode seguir a vida normalmente") |
| 6 | O valor citado é o do pipeline, e todo número da parte 2 é o valor ou um limite da faixa | `valor_divergente` | explicação (parte 2) | "128 mg/dL" quando o laudo diz 118; "19 acima do limite" (número inventado) | Número errado em outra parte; valor por extenso ("cento e dezoito") |
| 7 | A posição citada é a do pipeline, e só ela | `classificacao_contradita` | explicação (parte 2) | "está dentro da faixa" quando a classificação é "acima"; posição ausente; duas posições | Contradição nas outras partes (só a parte 2 é conferida) |

Um mesmo texto pode ter vários motivos, devolvidos sempre na ordem da tabela. A IA recebe esses códigos na nova tentativa.

## Laço de regeneração e mensagem padrão
- `MAX_REGENERACOES = 2` (no `.env`) → até **3 tentativas**. **Por que 2:** cada tentativa é uma chamada ao modelo na nuvem (até `OLLAMA_TIMEOUT_MS`). Na demo, 3 chamadas já são o limite de espera aceitável diante da banca. Mais tentativas aumentariam o tempo sem garantia de que o modelo corrija o erro.
- Esgotou → mensagem padrão, montada **sem o modelo**: ficha da base + valor e posição do pipeline + aviso fixo. O teste confere que ela passa na própria camada para os 5 exames e para as 3 classificações, com e sem alerta crítico.
- Erro do modelo (fora do ar ou lento) **não** é reprovação: a rota devolve `MODELO_INDISPONIVEL` (contrato §7).

## Custo dos falsos positivos (medido nos samples)
- **Samples (23 casos):** 7 respostas boas, todas aprovadas (0 falsos positivos); 16 ruins, todas reprovadas com os motivos esperados (0 falsos negativos).
- **Falso negativo achado pelos próprios testes e corrigido:** o termo "preocupa*" não pegava "não se preocupe". Virou "preocup*".
- **Falsos positivos conhecidos** (frases aceitáveis que a camada reprova; fixados em teste):
  - "Isso não significa que você tem diabetes" → `termo_diagnostico` (nome de doença é proibido mesmo negado);
  - "Não se preocupe com o jejum: água pode" → `termo_veredito`;
  - "a dose de açúcar no sangue" → `termo_prescricao`;
  - sobrenome do paciente que é palavra comum ("Teste") é trocado na pseudonimização (BWL-07, não nesta camada).
- **Custo:** cada falso positivo gasta uma regeneração (mais uma chamada ao modelo). Se todas falharem, o paciente recebe a mensagem padrão, que é correta mas mais pobre. É o lado seguro do erro: a camada prefere reprovar uma resposta boa a deixar passar uma ruim.

## Limite principal
A camada **só foi testada com respostas escritas por nós**. Com o modelo real (`beam`), só 7 respostas passaram pela camada até 04/11 (todas aprovadas): pouco para medir a taxa de falsos positivos e negativos. Próximo passo: rodar respostas reais do modelo pela camada, anotar os erros e ajustar `termosProibidos.json`.
