# CLAUDE.md — backend/src/pipeline (Bruno — BWL)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seção "Pipeline → orquestrador").

## Escopo desta pasta
Transformar um laudo (PDF digital ou imagem) em um **laudo estruturado e classificado**, sem usar o modelo de linguagem. Roda no envio do laudo (momento 1 do fluxo); o resultado alimenta a tela de exames e fica na sessão para a explicação e o chat.
Etapas, nesta ordem, cada uma testável isoladamente:
1. Extração de texto: PDF digital com `pdf-parse`; imagem/escaneado com OCR (`tesseract.js`).
2. Estruturação por analito: nome no laudo, valor, unidade, faixa de referência do laudo.
3. Normalização do nome para o identificador canônico da base (usa a lista de `nomes_alternativos` de `docs/base-conhecimento/exames.json`). Vem antes da confiança porque, na foto, "nome reconhecido" é um dos sinais.
4. Confiança da extração: se baixa (geral ou de um item), devolver o erro do contrato (pedir novo envio) **antes** de classificar. Nunca chutar valores.
5. Classificação por regra determinística: dentro / acima / abaixo da faixa DO LAUDO + alerta crítico por limite por analito.
6. Identificadores (BWL-07): o laudo estruturado contém só os campos do contrato (lista do que entra), sem identificador do paciente. Os identificadores do cabeçalho (`extrairIdentificadores.js`) saem SEPARADOS, em `identificadores` (contrato §2.6), só para a sessão do orquestrador usar como lista do que apagar do chat. A pseudonimização em si fica em `../seguranca/pseudonimizar.js` (`docs/pseudonimizacao.md`).

## Regras
- O modelo de linguagem NUNCA classifica nem decide alerta. Aqui só há regras no código.
- Limites críticos ficam em um arquivo de configuração próprio (separado da lógica), cada um com o campo `fonte`. **Limite sem fonte citável não entra.** A banca vai perguntar de onde veio cada número.
- Analito sem ficha na base: `id_canonico: null`, classificado normalmente pela faixa do laudo, `alerta_critico: false` (não há limite para ele). Não é erro do laudo inteiro.
- Um mesmo `id_canonico` aparece no máximo uma vez por laudo (é a chave da explicação e do chat).
- A faixa de referência é SEMPRE a que está no laudo. Não use faixa "padrão" do código.
- Fronteiras da faixa (sentido literal do texto impresso; compara o número como impresso, vírgula → ponto, sem arredondar):
  - "X a Y": limites INCLUSIVOS. `v < X` → abaixo; `v > Y` → acima; senão dentro (70 e 99 em "70 a 99" estão dentro).
  - "Inferior a Y" / "Menor que Y": `v ≥ Y` → acima (190 em "Inferior a 190" é acima).
  - "Superior a X" / "Maior que X": `v ≤ X` → abaixo.
  - "Até Y" / "Menor ou igual a Y": `v > Y` → acima.
  - Formato de faixa não reconhecido → não chutar: tratar como baixa confiança daquele item.
  - Casos de teste: `samples/laudos/glicose_limite.pdf` (99 → dentro) e `colesterol_total_limite.pdf` (190 → acima).
- Valores com vírgula decimal (ex.: `1,8`) e unidades variadas são casos reais de laudo: tratar e testar.
- OCR no Docker: `tesseract.js` baixa o idioma (`por`) na primeira execução. Para não depender de internet na apresentação, deixe o arquivo de idioma disponível localmente (volume ou cópia na imagem).
- Prioridade: PDF digital (P0). OCR (P1) feito na BWL-10.

## OCR (BWL-10): onde está cada coisa
- `extrairTextoImagem.js`: UM worker do Tesseract.js, criado na 1ª leitura (ou na subida, `aquecerOcr`) e reaproveitado. Idiomas de `TESSDATA_PATH` (Docker, sem rede) ou baixados uma vez para a pasta temporária (fora do Docker). `errorHandler` obrigatório: sem ele, imagem corrompida derruba o servidor.
- `corrigirTextoOcr.js`: correções de LETRA medidas nas fotos de `samples/` (µ, g, espaço da faixa). Nunca dígito. Cada correção nova precisa de teste.
- `extrairTextoPdf.js` → `renderizarPaginasPdf`: PDF sem camada de texto vira PNG (até 5 páginas) para o OCR.
- `processarLaudo.js` → `processarLaudoImagem` e o ramo "sem camada de texto" de `processarLaudoPdf`. Confiança: média da página (a da linha foi medida e descartada: `docs/confianca-extracao.md`).
- Testes: `test/pipeline/ocr.test.js` (Tesseract real, lento, ~8 s) e `corrigirTextoOcr.test.js`. Rotas usam OCR simulado.

## Estruturação (BWL-03): decisões e limites conhecidos
Formato de saída no contrato §2.2. Testes em `backend/test/pipeline/estruturarAnalitos.test.js` (texto real de `samples/laudos/texto_extraido/` + fixtures em string).
Decisões:
- Números: vírgula decimal, ponto de milhar; ponto que não forma grupos de 3 dígitos é lido como decimal. Nunca `parseFloat` direto.
- Linha só vira analito com nome + valor + (unidade OU faixa reconhecida). Sem valor legível → `nao_interpretadas`, nunca analito.
- Valor com sinal ("< 0,5") → `nao_interpretadas` (`valor_com_sinal`): não inventar número.
- Faixa com várias categorias: usa a de rótulo "Normal"/"Desejável"/"Ótimo"/"Adequado"; sem exatamente uma, não escolhe (faixa não interpretada).
- Da faixa só se remove a unidade do próprio resultado; nenhuma outra palavra.
Limites (o parser NÃO cobre):
- Nome com dígito na MESMA linha do valor ("T4 livre 1,2 ng/dL") → vai para `nao_interpretadas`. Na linha acima do "Resultado:" ("VITAMINA B12") é aceito desde o Layout C.
- Unidade sem `/` nem `%` (fL, pg) não é reconhecida como unidade.
- Nome quebrado em duas linhas ("Glicose em" / "jejum 88 ...") → nome fica só "jejum" (teste `todo`).
- Valor sem nome logo abaixo do cabeçalho da tabela usa o cabeçalho como nome (teste `todo`); a BWL-04 não acha ficha e vira `id_canonico: null`.
- Faixa por sexo/idade na mesma linha ("Homens: ... Mulheres: ...") → não interpretada.
- Faixa em categorias (uma por linha): usa a de rótulo normal/desejável/ótimo/adequado/**Adultos**/"Valores normais" se houver EXATAMENTE uma; senão não interpretada, mesmo com uma categoria só ("Recém-nascido: 100 - 250" não é a do paciente). Por sexo nunca escolhe.
- Layout C (`test/pipeline/layoutC.test.js`, formato de um laudo real, dados fictícios): valor antes do nome no hemograma ("14.2 HEMOGLOBINA g/dL (13,5 a 17,5)"), faixa entre parênteses, unidade colada ("450.000/mm3"), "Entre X e Y", cabeçalho "Valor de Referência" acima do resultado, nome "SIGLA - NOME" (reconhecido pelas partes em normalizarNome.js), registro "CRBM 00000" ignorado.
- Leucograma com % e valor absoluto na mesma linha ("1 BASÓFILOS 63 (0 a 105) (0 a 1)"): ambíguo, não interpretado.
- Layout D (`test/pipeline/layoutD.test.js`, urina, formato de um laudo real, dados fictícios): colunas "Rótulo : resultado <TAB> referência" lidas na linha BRUTA (o TAB separa resultado e referência); seção de urina (do título até o fim da página) → `material: 'urina'` e `id_canonico: null`; densidade com ponto decimal ("1.010" = 1,010); pH e densidade adimensionais; descritivos em `resultadosDescritivos.js`; frase com 5+ palavras antes de um número é ignorada.
- Outros layouts não foram testados: cada laboratório novo pode precisar de regra nova.

## BWL-04 a BWL-06: onde está cada coisa
Encadeamento: `processarLaudo.js` (`processarLaudoPdf`, `processarTextoLaudo`). Contrato §2.3 a §2.6.
- BWL-04 `normalizarNome.js`: normalização (acento, maiúscula, pontuação, espaços) + comparação EXATA. Fichas `pendente` também são reconhecidas (contrato §3).
- BWL-05 `classificar.js` (funções puras) + `limitesCriticos.json` (números + fonte + trecho). Não converte unidades. Doc: `docs/limites-criticos.md`.
- BWL-06 `confianca.js` + limiares SÓ em `config.js` (do `.env`). Doc: `docs/confianca-extracao.md`.
- Testes: `test/pipeline/{normalizarNome,classificar,confianca,processarLaudo}.test.js`. O de ponta a ponta usa os PDFs de `samples/laudos/` e confere contra o gabarito.

## Modo de trabalho (Bruno)
Modo GUIADO. Bruno é forte em Java e Python, SQL; JavaScript/Node é a maior lacuna; nunca usou OCR.
- Explique cada conceito antes (OCR, regex, expressões regulares, async/await, módulos), relacionando com Java/Python quando ajudar.
- Peça para ele testar cada etapa isolada (com os JSONs/PDFs de `samples/`) antes de passar para a próxima.
- Lógica de programação ainda é ponto a fortalecer: não presuma que ele resolve algoritmos complexos sozinho; quebre em partes.
