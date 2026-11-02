# Confiança da extração e "envie novamente" (BWL-06)

O artigo diz: "Quando a extração não atingir um nível mínimo de confiança, como em imagens desfocadas, o sistema solicitará um novo envio em vez de prosseguir com dados incertos." Este documento explica como isso foi feito. Código: `backend/src/pipeline/confianca.js`; limiares: `backend/src/pipeline/config.js`.

A confiança é calculada **antes** da classificação: um item em que não confiamos não é classificado, e o seu valor nunca é mostrado.

## Confiança de cada analito (0 a 1)

Sinais objetivos, cada um ok ou não ok:

| Sinal | O que confere | Conta no PDF digital | Conta na foto (OCR) |
|---|---|---|---|
| `nome_presente` | há nome | sim | sim |
| `valor_numerico` | o valor é um número válido | sim | sim |
| `unidade_presente` | a unidade foi lida | sim | sim |
| `faixa_interpretada` | a faixa de referência foi entendida | sim | sim |
| `nome_reconhecido` | o nome está na base (BWL-04) | **não** | sim |

`confiança = sinais ok ÷ sinais que contam`, e na foto ainda **× confiança do Tesseract ÷ 100** (a da linha, se houver; senão a média da página). Arredondada em 2 casas: o número mostrado é o mesmo que foi comparado.

**Por que o nome reconhecido só conta na foto:** no PDF digital o texto é exato; um nome fora da base é um exame que a base não tem (ex.: Ureia), e o contrato manda seguir com `id_canonico: null`. Numa foto, um nome irreconhecível ("Glicoze") é sinal de leitura errada.

**Por que a unidade "diferente da esperada" não reduz a confiança:** glicose em mmol/L é um laudo legítimo; reenviar não muda nada. Ela vira um aviso no item e impede só a avaliação do limite crítico (`docs/limites-criticos.md`).

## Limiar: 0,80 (variável `CONFIANCA_MINIMA_EXTRACAO`)

Definido em um único lugar (`config.js`, lido do `.env`; padrão 0,80, valor que já estava no `.env.example`). Motivo:

- No PDF digital, os valores possíveis são 1; 0,75; 0,5... Com 0,80, **o item só passa com os 4 campos obrigatórios** (nome, valor, unidade, faixa). Faltou um, 0,75: não passa. É uma regra fácil de explicar.
- Na foto, os 4 campos lidos com o Tesseract a 80% ou mais.
- Mudar o limiar não exige mexer no código; os testes passam o limiar por parâmetro.

Na foto há também `CONFIANCA_MINIMA_OCR` (padrão 70, escala 0 a 100 do Tesseract): se a **média da página** ficar abaixo, a foto é recusada logo no início (foto borrada), sem olhar os analitos.

## Decisão do laudo inteiro

Nesta ordem:
1. Foto com confiança média do OCR < `CONFIANCA_MINIMA_OCR` → erro `BAIXA_CONFIANCA` (motivo `ocr_baixa_confianca`).
2. Nenhuma linha com cara de resultado → erro (`nenhum_resultado_encontrado`).
3. `confianca_extracao` = **média** da confiança de todas as linhas de resultado. As linhas que parecem resultado mas nem viraram analito (`nao_interpretadas` da BWL-03, ex.: "< 0,01") entram com **0**. Abaixo do limiar → erro (`confianca_abaixo_do_minimo`).
4. Nenhum analito confiável → erro (`nenhum_resultado_confiavel`). Rede de segurança: com o mesmo limiar nos dois níveis, a regra 3 já pega.
5. Senão, o laudo **segue**.

## Caso misto (alguns analitos falharam): decisão

**Segue com os confiáveis e sinaliza os demais**, desde que a média do laudo fique no limiar (regra 3).
- Os confiáveis são classificados e vão para a tela.
- Os não confiáveis vão para `itens_nao_lidos` com nome e motivos, **sem valor**, e o laudo traz `aviso_usuario`: "Não conseguimos ler alguns resultados deste laudo com segurança, por isso eles não aparecem aqui. Confira esses resultados no laudo original ou envie o arquivo de novo."
- Se a média ficar abaixo do limiar, o laudo inteiro é recusado.

Exemplos (laudos sintéticos):
- `painel_parcial_ilegivel.pdf`: 5 linhas boas + creatinina com faixa "Ver observação no verso" → (5 + 0,75) / 6 = **0,96**: segue; creatinina sinalizada.
- `painel_maioria_ilegivel.pdf`: glicose boa, hemoglobina sem faixa (0,75), creatinina sem faixa (0,75), TSH "< 0,01" (0) → 2,5 / 4 = **0,63**: recusado.

Por quê: um painel com um item ruim continua útil e nada incerto é exibido. Pedir novo envio de um PDF digital por causa de uma linha não ajudaria (o mesmo arquivo dá o mesmo resultado). Mas quando a maior parte não foi lida, o mais provável é arquivo ruim, e aí pedimos novo envio.

Atenção: um 4º item ilegível num painel de 4 dá (3 + 0) / 4 = 0,75 e **recusa** o laudo. É conservador de propósito; se o grupo preferir outro comportamento, basta ajustar o limiar.

## Repetição do mesmo exame

O contrato exige um `id_canonico` por laudo. Repetido com o mesmo valor e unidade: fica o primeiro. Com valores diferentes: o sistema não escolhe; os dois vão para `itens_nao_lidos` (`exame_repetido_com_valores_diferentes`).

## Formato do erro

Contrato §7. Mensagens fixas (sem o modelo), em `confianca.js`:

```json
{ "status": "erro", "erro": { "codigo": "BAIXA_CONFIANCA", "motivo": "ocr_baixa_confianca",
  "mensagem_usuario": "Não conseguimos ler bem a foto do seu exame. Tente de novo com uma foto nítida, com boa luz, sem sombras e com o laudo inteiro aparecendo, ou envie o PDF original do laboratório." } }
```

## Limitação atual

O OCR (BWL-10) ainda não existe. O caminho da foto está implementado e testado com a confiança do Tesseract **simulada** (testes em `backend/test/pipeline/processarLaudo.test.js`). `foto_borrada.jpg` ainda não passa pelo pipeline: hoje uma imagem para na BWL-02 (`ARQUIVO_NAO_E_PDF`).
