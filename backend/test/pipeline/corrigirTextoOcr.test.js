// Correções do texto do OCR (BWL-10). Cada caso veio de uma leitura real do
// Tesseract nas imagens sintéticas de samples/laudos/.
// Rodar: npm test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { corrigirTextoOcr } from '../../src/pipeline/corrigirTextoOcr.js';

describe('corrigirTextoOcr: o que corrige', () => {
  it('faixa sem espaço antes do "a" (foto_painel_misto.jpg): "12,0a 16,0" → "12,0 a 16,0"', () => {
    assert.equal(corrigirTextoOcr('Hemoglobina 13,8 g/dL 12,0a 16,0'), 'Hemoglobina 13,8 g/dL 12,0 a 16,0');
  });
  it('faixa sem espaço depois do "a": "12,0 a16,0" → "12,0 a 16,0"', () => {
    assert.equal(corrigirTextoOcr('12,0 a16,0'), '12,0 a 16,0');
  });
  it('micro lido como H, p ou u (foto_painel_misto.jpg): → "µUI/mL"', () => {
    for (const lido of ['HUI/mL', 'pUI/mL', 'uUI/mL']) {
      assert.equal(corrigirTextoOcr(`TSH 7,80 ${lido} 0,45 a 4,50`), 'TSH 7,80 µUI/mL 0,45 a 4,50');
    }
  });
  it('"g" lido como "a" ou "q" (digitalizado_sem_texto.pdf): → "mg/dL"', () => {
    assert.equal(corrigirTextoOcr('Glicose em jejum 118 ma/dL 70 a 99'), 'Glicose em jejum 118 mg/dL 70 a 99');
    assert.equal(corrigirTextoOcr('Glicose em jejum 118 mq/dL 70 a 99'), 'Glicose em jejum 118 mg/dL 70 a 99');
  });
  it('unidade no fim da linha e em várias linhas', () => {
    assert.equal(corrigirTextoOcr('Resultado: 7,80 HUI/mL\nResultado: 118 ma/dL'), 'Resultado: 7,80 µUI/mL\nResultado: 118 mg/dL');
  });
});

describe('corrigirTextoOcr: o que NÃO mexe', () => {
  it('texto já correto fica igual', () => {
    const linha = 'Glicose em jejum 118 mg/dL 70 a 99';
    assert.equal(corrigirTextoOcr(linha), linha);
  });
  it('nunca muda dígito (um número errado não se adivinha)', () => {
    for (const linha of ['Glicose em jejum 113 mg/dL 70 a 99', 'Idade: 34 anos', 'Rua Exemplo, 000', 'CPF: 000.000.000-00']) {
      assert.equal(corrigirTextoOcr(linha), linha);
    }
  });
  it('"a" que não está entre dois números fica como está', () => {
    for (const linha of ['Paciente: Maria Teste da Silva', 'Coleta: 20/10/2026 07:40', '34anos']) {
      assert.equal(corrigirTextoOcr(linha), linha);
    }
  });
  it('só troca a unidade como palavra inteira, não um pedaço de outra palavra', () => {
    assert.equal(corrigirTextoOcr('xHUI/mL'), 'xHUI/mL');
    assert.equal(corrigirTextoOcr('ma/dLx'), 'ma/dLx');
  });
  it('entrada que não é texto → texto vazio', () => {
    assert.equal(corrigirTextoOcr(undefined), '');
    assert.equal(corrigirTextoOcr(null), '');
  });
});
