# Pseudonimização (BWL-07)

Objetivo: **nada que identifique o paciente chega ao modelo de linguagem**, nem aos logs, nem ao front.
Onde acontece: na **entrada da IA**, dentro do orquestrador. Toda chamada ao modelo passa por um único arquivo (`backend/src/api/adaptadorIa.js`), que recebe a entrada já montada por `montarEntradaIa` (`backend/src/seguranca/pseudonimizar.js`).

## Pseudonimização × anonimização (LGPD)
- **Anonimização** (art. 5º, XI): o dado não pode mais ser associado à pessoa por nenhum meio razoável. Dado anonimizado deixa de ser dado pessoal (art. 12).
- **Pseudonimização** (art. 13, § 4º): o dado só pode ser associado à pessoa com uma informação adicional que o controlador guarda separada e em ambiente controlado.
- **O Lumie faz pseudonimização, não anonimização.** O servidor guarda na sessão os identificadores e o mapa de substituição (`[PACIENTE_1]` → valor). Com eles, o servidor consegue religar o dado à pessoa; o modelo não consegue.
- O que vai ao modelo **continua sendo dado de saúde** (dado pessoal sensível, art. 5º, II): um valor de glicose. A pseudonimização tira o vínculo com a pessoa, não a natureza do dado.

## Duas camadas
1. **Lista de permissão (o que ENTRA, não o que sai).** A entrada da IA é montada campo a campo. Só entram:
   - do analito: `id_canonico`, `valor`, `unidade`, limites da faixa (`minimo`, `maximo`, `minimo_inclusivo`, `maximo_inclusivo`), `classificacao`, `alerta_critico`;
   - a ficha da base de conhecimento daquele exame.

   Qualquer campo novo que alguém acrescente ao laudo fica de fora até ser incluído de propósito nesta lista.
2. **Varredura (texto livre).** A lista de permissão não protege o texto que o próprio paciente digita. Por isso todo texto livre passa por `pseudonimizarTexto` antes de entrar: `nome_no_laudo`, a mensagem do chat e o histórico do chat. A varredura usa:
   - **dicionário:** os identificadores lidos do cabeçalho do laudo daquela sessão (nome completo e cada parte do nome, sem diferenciar maiúsculas/minúsculas, com e sem acento);
   - **padrões (expressões regulares):** CPF (com e sem pontuação), RG, datas, telefone, e-mail, CEP, CRM, número de pedido/protocolo/prontuário/atendimento, "meu nome é X".

   Cada trecho encontrado vira um marcador (`[PACIENTE_1]`, `[CPF_1]`...). O mapa marcador → valor fica só na sessão. A troca **não** é desfeita na tela.

## Ciclo de vida dos identificadores
O pipeline lê o cabeçalho do laudo (`extrairIdentificadores`) e devolve os identificadores **fora** do laudo estruturado. Eles ficam só na sessão em memória do servidor, servem só como lista do que apagar e são descartados quando a sessão expira (`SESSION_TTL_MINUTES`). Nunca vão para a IA, o front ou os logs. O log (`registrarEvento`) só aceita códigos e números, nunca texto livre.

## O que é e o que não é identificador
| Tipo | Exemplos | Tratamento |
|---|---|---|
| Identificador direto | nome, CPF, RG, data de nascimento, telefone, e-mail, endereço/CEP, nº do pedido/protocolo/prontuário/atendimento | Nunca entra (lista de permissão) e é varrido do texto livre |
| Identificador de terceiro | médico solicitante e CRM, responsável técnico | Igual ao anterior: identifica outra pessoa e ajuda a localizar o paciente |
| Quase-identificador | sexo, idade, datas de coleta e liberação, nome e endereço do laboratório | Não entra (fica fora da lista de permissão). Sozinho não identifica; combinado, pode identificar |
| Não é identificador | `id_canonico`, valor, unidade, faixa, classificação, alerta, ficha da base | Entra. É o mínimo para explicar o exame |

## O que a varredura NÃO pega (limites conhecidos)
- Nomes que não estão no cabeçalho: "minha mãe Joana", apelidos, nomes digitados com erro ("Mraia").
- Números fora dos formatos previstos ou escritos por extenso ("zero zero zero...").
- Endereço sem CEP ("moro na rua tal, 123").
- Identificação indireta por contexto ("sou a única professora da escola X").
- Se o cabeçalho não for lido (layout desconhecido, OCR ruim), o dicionário fica vazio e sobram só os padrões.
- Falso positivo: parte do nome que também é palavra comum (ex.: sobrenome "Rosa") pode trocar a palavra comum por marcador. Preposições do nome ("da", "de", "dos") e palavras curtas comuns ("no", "em", "ou"...) não entram no dicionário. Partes de 2 letras ENTRAM desde 04/11/2026: sobrenomes como "Lu", "Li" identificam a pessoa e antes passavam.
- **Corrigido em 04/11/2026, com um laudo real (fora do repositório):** o cabeçalho "Paciente: 000123 - NOME" guardava só o código, e "Sou o [primeiro nome]" chegava à IA com o nome. Também não liam "Data Nasc.:" nem o médico em "Solicitante: CRM-SP-000000 NOME". Os três formatos estão em `backend/test/pipeline/layoutC.test.js` (dados fictícios). Lição: cada laboratório novo pode ter um cabeçalho que o extrator não conhece, e aí sobram só os padrões genéricos.
- O teste prova o que **entra** na IA (a saída de `montarEntradaIa`), não o pacote final enviado ao Ollama. Se o código da IA acrescentar dados ao prompt, este teste não vê (registrado em `artigo-vs-prototipo.md`).

## Onde está no código e como é testado
| Peça | Arquivo | Teste |
|---|---|---|
| Identificadores do cabeçalho | `backend/src/pipeline/extrairIdentificadores.js` | `backend/test/pipeline/extrairIdentificadores.test.js` |
| Separação laudo × identificadores | `backend/src/pipeline/processarLaudo.js` | `backend/test/pipeline/processarLaudo.test.js` |
| Varredura + lista de permissão | `backend/src/seguranca/pseudonimizar.js` | `backend/test/seguranca/pseudonimizar.test.js` (paciente sintético em `pacienteSintetico.js`) |
| Único caminho até a IA | `backend/src/api/adaptadorIa.js` | `backend/test/api/rotas.test.js` (a IA falsa captura tudo que recebe pelas rotas) |
| Log só com códigos e números | `backend/src/seguranca/registrarEvento.js` | `backend/test/seguranca/registrarEvento.test.js` |

**Como saber que o teste não passa à toa:**
- **Controle:** sem a varredura, o detector acha os identificadores.
- **Mutação manual:** com `pseudonimizarTexto` devolvendo o texto sem mexer, 25 testes de `pseudonimizar.test.js` e o teste de chat de `rotas.test.js` ficam vermelhos. O teste da explicação continua verde porque a lista de permissão sozinha já barra o cabeçalho.
