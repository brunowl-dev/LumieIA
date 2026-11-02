// Testes da BWL-06 (confiança da extração e erro "envie novamente").
// Rodar: npm test. Os analitos aqui são objetos montados à mão (sintéticos).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVISO_ITENS_NAO_LIDOS,
  MENSAGENS_BAIXA_CONFIANCA,
  avaliarConfiancaAnalito,
  avaliarConfiancaLaudo,
  criarErroBaixaConfianca,
} from '../../src/pipeline/confianca.js';
import { CONFIANCA_MINIMA_EXTRACAO, CONFIANCA_MINIMA_OCR } from '../../src/pipeline/config.js';
import { interpretarFaixa } from '../../src/pipeline/estruturarAnalitos.js';

const LIMIAR = 0.8;
const LIMIAR_OCR = 70;
const PDF = { origem: 'pdf_digital', limiar: LIMIAR };
const OCR = (confiancaOcrLaudo) => ({ origem: 'ocr', limiar: LIMIAR, confiancaOcrLaudo });

// Analito completo, como sai da BWL-03 + BWL-04. Cada teste estraga um campo.
const analito = (mudancas = {}) => ({
  nome_no_laudo: 'Glicose em jejum',
  valor: 118,
  unidade: 'mg/dL',
  faixa_referencia: interpretarFaixa('70 a 99'),
  id_canonico: 'glicose',
  ...mudancas,
});

describe('config: limiares num lugar só', () => {
  it('padrões quando o .env não define (0,80 e 70)', () => {
    // Os testes rodam sem .env; se alguém exportar a variável, este teste avisa.
    if (process.env.CONFIANCA_MINIMA_EXTRACAO === undefined) assert.equal(CONFIANCA_MINIMA_EXTRACAO, 0.8);
    if (process.env.CONFIANCA_MINIMA_OCR === undefined) assert.equal(CONFIANCA_MINIMA_OCR, 70);
  });
});

describe('avaliarConfiancaAnalito: PDF digital', () => {
  it('todos os campos → 1, confiável', () => {
    assert.deepEqual(avaliarConfiancaAnalito(analito(), PDF), {
      confianca: 1,
      confiavel: true,
      motivos: [],
      sinais: { nome_presente: true, valor_numerico: true, unidade_presente: true, faixa_interpretada: true },
    });
  });
  const faltando = [
    ['unidade ausente', { unidade: null }, 'unidade_ausente'],
    ['faixa não interpretada', { faixa_referencia: interpretarFaixa('Ver observação') }, 'faixa_nao_interpretada'],
    ['faixa ausente', { faixa_referencia: interpretarFaixa('') }, 'faixa_nao_interpretada'],
    ['valor não numérico', { valor: Number.NaN }, 'valor_invalido'],
    ['valor ausente', { valor: undefined }, 'valor_invalido'],
    ['nome vazio', { nome_no_laudo: '  ' }, 'nome_ausente'],
  ];
  for (const [nome, mudanca, motivo] of faltando) {
    it(`${nome} → 0,75, não confiável (${motivo})`, () => {
      const r = avaliarConfiancaAnalito(analito(mudanca), PDF);
      assert.deepEqual([r.confianca, r.confiavel, r.motivos], [0.75, false, [motivo]]);
    });
  }
  it('dois campos faltando → 0,5', () => {
    assert.equal(avaliarConfiancaAnalito(analito({ unidade: null, faixa_referencia: interpretarFaixa('') }), PDF).confianca, 0.5);
  });
  it('nome fora da base NÃO reduz a confiança no PDF (exame sem ficha segue, id null)', () => {
    const r = avaliarConfiancaAnalito(analito({ nome_no_laudo: 'Ureia', id_canonico: null }), PDF);
    assert.deepEqual([r.confianca, r.confiavel], [1, true]);
  });
  it('o limiar vem por parâmetro: com 0,7 o item com 3 de 4 campos passa', () => {
    assert.equal(avaliarConfiancaAnalito(analito({ unidade: null }), { origem: 'pdf_digital', limiar: 0.7 }).confiavel, true);
  });
});

describe('avaliarConfiancaAnalito: OCR (foto)', () => {
  it('campos completos × confiança do Tesseract da página (92) → 0,92', () => {
    const r = avaliarConfiancaAnalito(analito(), OCR(92));
    assert.deepEqual([r.confianca, r.confiavel], [0.92, true]);
    assert.equal(r.sinais.nome_reconhecido, true);
  });
  it('a confiança da LINHA tem prioridade sobre a da página', () => {
    assert.equal(avaliarConfiancaAnalito(analito({ confianca_ocr: 60 }), OCR(92)).confianca, 0.6);
  });
  it('OCR 79 (abaixo de 80%) → não confiável, motivo confianca_ocr_baixa', () => {
    const r = avaliarConfiancaAnalito(analito(), OCR(79));
    assert.deepEqual([r.confianca, r.confiavel, r.motivos], [0.79, false, ['confianca_ocr_baixa']]);
  });
  it('OCR 80 (exatamente no limiar) → confiável', () => {
    assert.equal(avaliarConfiancaAnalito(analito(), OCR(80)).confiavel, true);
  });
  it('nome irreconhecível na foto ("Glicoze") conta como sinal ruim', () => {
    const r = avaliarConfiancaAnalito(analito({ nome_no_laudo: 'Glicoze em jejum', id_canonico: null }), OCR(95));
    assert.equal(r.confianca, 0.76); // 4 de 5 sinais × 0,95
    assert.equal(r.confiavel, false);
    assert.deepEqual(r.motivos, ['nome_nao_reconhecido']);
  });
  it('sem confiança do OCR nenhuma → 0 (não presume que a foto está boa)', () => {
    const r = avaliarConfiancaAnalito(analito(), OCR(null));
    assert.deepEqual([r.confianca, r.confiavel, r.motivos], [0, false, ['confianca_ocr_ausente']]);
  });
});

// Atalho: monta um analito já avaliado (como o pipeline faz antes de decidir o laudo).
const avaliado = (mudancas, opcoes = PDF) => {
  const a = analito(mudancas);
  return { ...a, avaliacao: avaliarConfiancaAnalito(a, opcoes) };
};
const laudo = (analitos, naoInterpretadas = 0) => ({
  analitos,
  nao_interpretadas: Array.from({ length: naoInterpretadas }, () => ({ linha: '(sintética)', motivo: 'valor_com_sinal' })),
});
const decidirPdf = (estruturado) => avaliarConfiancaLaudo(estruturado, { origem: 'pdf_digital', limiar: LIMIAR, limiarOcr: LIMIAR_OCR });

describe('avaliarConfiancaLaudo: decisão do laudo inteiro', () => {
  it('todos confiáveis → segue, confiança 1', () => {
    assert.deepEqual(decidirPdf(laudo([avaliado(), avaliado({ id_canonico: 'tsh' })])), { segue: true, confianca_extracao: 1 });
  });
  it('caso misto: 4 bons + 1 com faixa ilegível → média 0,95, SEGUE (o ruim é sinalizado depois)', () => {
    const r = decidirPdf(laudo([avaliado(), avaliado(), avaliado(), avaliado(), avaliado({ faixa_referencia: interpretarFaixa('?') })]));
    assert.deepEqual(r, { segue: true, confianca_extracao: 0.95 });
  });
  it('caso misto ruim: 1 bom + 1 sem unidade + 2 linhas não interpretadas → 0,44, erro', () => {
    const r = decidirPdf(laudo([avaliado(), avaliado({ unidade: null })], 2));
    assert.equal(r.segue, false);
    assert.equal(r.confianca_extracao, 0.44);
    assert.equal(r.erro.erro.motivo, 'confianca_abaixo_do_minimo');
  });
  it('linha não interpretada entra como 0 na média: 3 bons + 1 → 0,75, erro', () => {
    assert.equal(decidirPdf(laudo([avaliado(), avaliado(), avaliado()], 1)).segue, false);
  });
  it('nenhuma linha de resultado → erro nenhum_resultado_encontrado', () => {
    const r = decidirPdf(laudo([]));
    assert.equal(r.erro.erro.motivo, 'nenhum_resultado_encontrado');
    assert.equal(r.erro.erro.mensagem_usuario, MENSAGENS_BAIXA_CONFIANCA.sem_resultados);
  });
  it('média acima do limiar, mas nenhum item confiável → erro nenhum_resultado_confiavel', () => {
    // Só acontece com limiares diferentes (item 0,8; laudo 0,5): a regra 4 é uma rede de segurança.
    const r = avaliarConfiancaLaudo(laudo([avaliado({ unidade: null })]), { origem: 'pdf_digital', limiar: 0.5, limiarOcr: LIMIAR_OCR });
    assert.equal(r.erro.erro.motivo, 'nenhum_resultado_confiavel');
  });
  it('foto com OCR médio 40 (borrada) → erro antes de olhar os analitos', () => {
    const r = avaliarConfiancaLaudo(laudo([avaliado({}, OCR(95))]), { origem: 'ocr', limiar: LIMIAR, limiarOcr: LIMIAR_OCR, confiancaOcrLaudo: 40 });
    assert.equal(r.segue, false);
    assert.equal(r.erro.erro.motivo, 'ocr_baixa_confianca');
    assert.equal(r.erro.erro.mensagem_usuario, MENSAGENS_BAIXA_CONFIANCA.ocr);
  });
  it('foto com OCR 70 (no limiar) e itens bons → segue', () => {
    const r = avaliarConfiancaLaudo(laudo([avaliado({ confianca_ocr: 90 }, OCR(70))]), { origem: 'ocr', limiar: LIMIAR, limiarOcr: LIMIAR_OCR, confiancaOcrLaudo: 70 });
    assert.deepEqual(r, { segue: true, confianca_extracao: 0.9 });
  });
});

describe('criarErroBaixaConfianca: formato do contrato §7', () => {
  it('PDF digital', () => {
    assert.deepEqual(criarErroBaixaConfianca('pdf_digital', 'confianca_abaixo_do_minimo'), {
      status: 'erro',
      erro: { codigo: 'BAIXA_CONFIANCA', motivo: 'confianca_abaixo_do_minimo', mensagem_usuario: MENSAGENS_BAIXA_CONFIANCA.pdf_digital },
    });
  });
  it('foto: a mensagem fala de nitidez, luz e sombra', () => {
    const { mensagem_usuario: texto } = criarErroBaixaConfianca('ocr', 'ocr_baixa_confianca').erro;
    assert.match(texto, /foto nítida/);
    assert.match(texto, /luz/);
  });
  it('mensagens em linguagem simples, sem termos técnicos', () => {
    for (const texto of [...Object.values(MENSAGENS_BAIXA_CONFIANCA), AVISO_ITENS_NAO_LIDOS]) {
      assert.doesNotMatch(texto, /confian[çc]a|OCR|limiar|analito|extra[çc][ãa]o/i);
    }
  });
});
