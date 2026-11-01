# CLAUDE.md — backend/src/pipeline (Bruno — BWL)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seção "Pipeline → IA").

## Escopo desta pasta
Transformar um laudo (PDF digital ou imagem) em um **laudo estruturado e classificado**, sem usar o modelo de linguagem.
Etapas, cada uma testável isoladamente:
1. Extração de texto: PDF digital com `pdf-parse`; imagem/escaneado com OCR (`tesseract.js`).
2. Estruturação por analito: nome no laudo, valor, unidade, faixa de referência do laudo.
3. Normalização do nome para o identificador canônico da base (usa a lista de `nomes_alternativos` de `docs/base-conhecimento/exames.json`).
4. Classificação por regra determinística: dentro / acima / abaixo da faixa DO LAUDO + alerta crítico por limite por analito.
5. Confiança da extração: se baixa, devolver o erro do contrato (pedir novo envio), nunca chutar valores.
6. Pseudonimização: remover do que sai desta pasta qualquer identificador do paciente (nome, CPF, data de nascimento, endereço, número do pedido etc.).

## Regras
- O modelo de linguagem NUNCA classifica nem decide alerta. Aqui só há regras no código.
- Limites críticos ficam em um arquivo de configuração próprio (separado da lógica), cada um com o campo `fonte`. **Limite sem fonte citável não entra.** A banca vai perguntar de onde veio cada número.
- Se um analito não existir na base, devolver o erro `EXAME_NAO_ENCONTRADO` do contrato para aquele item.
- A faixa de referência é SEMPRE a que está no laudo. Não use faixa "padrão" do código.
- Valores com vírgula decimal (ex.: `1,8`) e unidades variadas são casos reais de laudo: tratar e testar.
- OCR no Docker: `tesseract.js` baixa o idioma (`por`) na primeira execução. Para não depender de internet na apresentação, deixe o arquivo de idioma disponível localmente (volume ou cópia na imagem).
- Prioridade: PDF digital (P0). OCR é P1 — se faltar tempo, é o primeiro corte; avise o grupo cedo, porque o artigo descreve OCR.

## Modo de trabalho (Bruno)
Modo GUIADO. Bruno é forte em Java e Python, SQL; JavaScript/Node é a maior lacuna; nunca usou OCR.
- Explique cada conceito antes (OCR, regex, expressões regulares, async/await, módulos), relacionando com Java/Python quando ajudar.
- Peça para ele testar cada etapa isolada (com os JSONs/PDFs de `samples/`) antes de passar para a próxima.
- Lógica de programação ainda é ponto a fortalecer: não presuma que ele resolve algoritmos complexos sozinho; quebre em partes.
