// Testes da BWL-05 (classificação pela faixa do laudo + limite crítico).
// Rodar: npm test. Funções puras: entrada e saída em objetos, sem PDF.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  avaliarLimiteCritico,
  carregarLimitesCriticos,
  classificarAnalito,
  classificarPelaFaixa,
  normalizarUnidade,
  unidadeCompativel,
  validarLimitesCriticos,
} from '../../src/pipeline/classificar.js';
import { interpretarFaixa } from '../../src/pipeline/estruturarAnalitos.js';

const limites = carregarLimitesCriticos(join(import.meta.dirname, '..', '..', 'src', 'pipeline', 'limitesCriticos.json'));
// A faixa sai do mesmo interpretador da BWL-03: o teste usa o texto como impresso.
const classificar = (valor, textoFaixa) => classificarPelaFaixa(valor, interpretarFaixa(textoFaixa)).classificacao;

describe('classificarPelaFaixa: "X a Y" (limites inclusivos)', () => {
  const casos = [
    [88, '70 a 99', 'dentro'],
    [118, '70 a 99', 'acima'],
    [62, '70 a 99', 'abaixo'],
    [70, '70 a 99', 'dentro'], // igual ao mínimo
    [99, '70 a 99', 'dentro'], // igual ao máximo (glicose_limite.pdf)
    [99.01, '70 a 99', 'acima'],
    [69.99, '70 a 99', 'abaixo'],
    [0.45, '0,45 a 4,50', 'dentro'],
    [4.51, '0,45 a 4,50', 'acima'],
    [1.3, '0,6 a 1,3', 'dentro'],
  ];
  for (const [valor, faixa, esperado] of casos) {
    it(`${valor} em "${faixa}" → ${esperado}`, () => assert.equal(classificar(valor, faixa), esperado));
  }
});

describe('classificarPelaFaixa: faixa só com máximo', () => {
  const casos = [
    [172, 'Inferior a 190', 'dentro'],
    [190, 'Inferior a 190', 'acima'], // exclusivo: o 190 fica de fora (colesterol_total_limite.pdf)
    [189.9, 'Inferior a 190', 'dentro'],
    [150, 'Até 150', 'dentro'], // inclusivo
    [150.1, 'Até 150', 'acima'],
    [150, '< 150', 'acima'],
    [150, '<= 150', 'dentro'],
    [0, 'Inferior a 190', 'dentro'], // sem mínimo: nunca "abaixo"
  ];
  for (const [valor, faixa, esperado] of casos) {
    it(`${valor} em "${faixa}" → ${esperado}`, () => assert.equal(classificar(valor, faixa), esperado));
  }
});

describe('classificarPelaFaixa: faixa só com mínimo', () => {
  const casos = [
    [50, 'Superior a 40', 'dentro'],
    [40, 'Superior a 40', 'abaixo'], // exclusivo: o 40 fica de fora
    [40, 'Maior ou igual a 40', 'dentro'], // inclusivo
    [39.9, 'Maior ou igual a 40', 'abaixo'],
    [10000, '> 40', 'dentro'], // sem máximo: nunca "acima"
  ];
  for (const [valor, faixa, esperado] of casos) {
    it(`${valor} em "${faixa}" → ${esperado}`, () => assert.equal(classificar(valor, faixa), esperado));
  }
});

describe('classificarPelaFaixa: não classifica sem dados (não chuta)', () => {
  it('valor ausente, NaN, texto ou infinito → valor_invalido', () => {
    const faixa = interpretarFaixa('70 a 99');
    for (const valor of [null, undefined, Number.NaN, '88', Number.POSITIVE_INFINITY]) {
      assert.deepEqual(classificarPelaFaixa(valor, faixa), { classificacao: null, motivo: 'valor_invalido' });
    }
  });
  it('faixa não interpretada ou ausente → faixa_nao_interpretada', () => {
    for (const faixa of [interpretarFaixa('Ver observação'), interpretarFaixa(''), null, {}]) {
      assert.deepEqual(classificarPelaFaixa(88, faixa), { classificacao: null, motivo: 'faixa_nao_interpretada' });
    }
  });
});

describe('normalizarUnidade e unidadeCompativel', () => {
  it('maiúsculas, espaços e os três "micro" (µ, μ, u) são iguais', () => {
    assert.equal(normalizarUnidade('mg/dL'), normalizarUnidade('MG/DL'));
    assert.equal(normalizarUnidade('mg / dL'), 'mg/dl');
    assert.equal(normalizarUnidade('µUI/mL'), normalizarUnidade('μUI/mL'));
    assert.equal(normalizarUnidade('µUI/mL'), normalizarUnidade('uUI/mL'));
    assert.equal(normalizarUnidade(null), null);
    assert.equal(normalizarUnidade('  '), null);
  });
  it('compara com a lista de unidades aceitas do exame', () => {
    assert.equal(unidadeCompativel('mg/dl', ['mg/dL']), true);
    assert.equal(unidadeCompativel('mmol/L', ['mg/dL']), false);
    assert.equal(unidadeCompativel('mUI/L', ['µUI/mL', 'mUI/L']), true);
    assert.equal(unidadeCompativel(null, ['mg/dL']), null);
    assert.equal(unidadeCompativel('mg/dL', undefined), null);
  });
});

const glicose = (valor, unidade = 'mg/dL') => avaliarLimiteCritico({ id_canonico: 'glicose', valor, unidade }, limites);

describe('avaliarLimiteCritico: glicose (PNCQ: < 45 e > 450 mg/dL)', () => {
  const casos = [
    [486, true, 'acima_de'], // glicose_critico_alto.pdf
    [38, true, 'abaixo_de'], // glicose_critico_baixo.pdf
    [451, true, 'acima_de'],
    [44.9, true, 'abaixo_de'],
    [450, false, null], // fronteira: "> 450" não inclui o 450
    [45, false, null], // fronteira: "< 45" não inclui o 45
    [118, false, null], // alterado, mas não crítico
    [88, false, null],
  ];
  for (const [valor, alerta, acionado] of casos) {
    it(`${valor} mg/dL → alerta ${alerta}`, () => {
      const r = glicose(valor);
      assert.equal(r.alerta_critico, alerta);
      assert.equal(r.limite_critico.avaliado, true);
      assert.equal(r.limite_critico.acionado, acionado);
    });
  }
  it('a saída traz a fonte usada (referência, url e trecho)', () => {
    const { fonte } = glicose(486).limite_critico;
    assert.equal(fonte.id, 'pncq_2019');
    assert.match(fonte.referencia, /PNCQ/);
    assert.match(fonte.url, /^https:\/\/pncq\.org\.br\//);
    assert.match(fonte.trecho_da_fonte, /< 45 mg\/dL.*> 450 mg\/dL/);
  });
  it('unidade escrita de outro jeito ("mg/dl") ainda é a mesma', () => {
    assert.equal(glicose(486, 'mg/dl').alerta_critico, true);
  });
});

describe('avaliarLimiteCritico: creatinina e hemoglobina', () => {
  const casos = [
    ['creatinina', 8.1, 'mg/dL', true], // > 7,4
    ['creatinina', 7.4, 'mg/dL', false], // fronteira
    ['creatinina', 0.1, 'mg/dL', false], // a fonte não tem limite inferior
    ['hemoglobina', 5.9, 'g/dL', true], // < 6,6
    ['hemoglobina', 6.6, 'g/dL', false], // fronteira
    ['hemoglobina', 20, 'g/dL', true], // > 19,9
    ['hemoglobina', 19.9, 'g/dL', false], // fronteira
    ['hemoglobina', 10.4, 'g/dL', false], // abaixo da faixa, mas não crítico
  ];
  for (const [id, valor, unidade, alerta] of casos) {
    it(`${id} ${valor} ${unidade} → alerta ${alerta}`, () => {
      assert.equal(avaliarLimiteCritico({ id_canonico: id, valor, unidade }, limites).alerta_critico, alerta);
    });
  }
});

describe('avaliarLimiteCritico: quando NÃO há alerta (e o porquê fica registrado)', () => {
  it('TSH e colesterol: sem limite crítico definido, nem com valor extremo', () => {
    for (const [id, valor, unidade] of [['tsh', 150, 'µUI/mL'], ['colesterol_total', 900, 'mg/dL']]) {
      const r = avaliarLimiteCritico({ id_canonico: id, valor, unidade }, limites);
      assert.equal(r.alerta_critico, false);
      assert.equal(r.limite_critico.avaliado, false);
      assert.equal(r.limite_critico.motivo, 'sem_limite_definido');
    }
  });
  it('exame sem ficha (id_canonico null) → exame_nao_reconhecido', () => {
    const r = avaliarLimiteCritico({ id_canonico: null, valor: 9999, unidade: 'mg/dL' }, limites);
    assert.deepEqual([r.alerta_critico, r.limite_critico.motivo], [false, 'exame_nao_reconhecido']);
  });
  it('unidade diferente (glicose em mmol/L) → não converte, não avalia', () => {
    const r = glicose(30, 'mmol/L'); // 30 mmol/L seria crítico em mg/dL, mas não convertemos
    assert.deepEqual([r.alerta_critico, r.limite_critico.avaliado, r.limite_critico.motivo], [false, false, 'unidade_diferente']);
    assert.equal(r.limite_critico.fonte.id, 'pncq_2019'); // o limite existe, só não foi aplicado
  });
  it('unidade ausente → unidade_diferente', () => {
    assert.equal(glicose(486, null).limite_critico.motivo, 'unidade_diferente');
  });
  it('valor não numérico → valor_invalido', () => {
    assert.equal(glicose(Number.NaN).limite_critico.motivo, 'valor_invalido');
  });
  it('limite com fonte "fonte_pendente" não é aplicado', () => {
    const config = validarLimitesCriticos({
      fontes: {},
      analitos: { glicose: { unidades_aceitas: ['mg/dL'], limite_critico: { unidade: 'mg/dL', abaixo_de: 45, acima_de: 450, fonte: 'fonte_pendente' } } },
    });
    const r = avaliarLimiteCritico({ id_canonico: 'glicose', valor: 486, unidade: 'mg/dL' }, config);
    assert.deepEqual([r.alerta_critico, r.limite_critico.motivo], [false, 'fonte_pendente']);
  });
});

describe('validarLimitesCriticos: o arquivo de configuração', () => {
  it('o arquivo real é válido e todo limite aponta para uma fonte cadastrada', () => {
    for (const [id, item] of Object.entries(limites.analitos)) {
      if (item.limite_critico === null) {
        assert.ok(item.sem_limite_critico.motivo, `${id} sem motivo`);
      } else {
        assert.ok(limites.fontes[item.limite_critico.fonte], `${id} sem fonte`);
        assert.ok(item.limite_critico.trecho_da_fonte, `${id} sem trecho da fonte`);
      }
    }
  });
  it('os 5 exames do protótipo estão no arquivo; TSH e colesterol sem limite', () => {
    assert.deepEqual(Object.keys(limites.analitos).sort(), ['colesterol_total', 'creatinina', 'glicose', 'hemoglobina', 'tsh']);
    assert.equal(limites.analitos.tsh.limite_critico, null);
    assert.equal(limites.analitos.colesterol_total.limite_critico, null);
  });
  const base = () => ({
    fontes: { f: { referencia: 'r', url: 'u' } },
    analitos: { x: { unidades_aceitas: ['mg/dL'], limite_critico: { unidade: 'mg/dL', abaixo_de: 1, acima_de: 9, fonte: 'f' } } },
  });
  const erros = [
    ['fonte inexistente', (c) => { c.analitos.x.limite_critico.fonte = 'outra'; }, /cita a fonte "outra"/],
    ['sem nenhum número', (c) => { c.analitos.x.limite_critico.abaixo_de = null; c.analitos.x.limite_critico.acima_de = null; }, /abaixo_de e\/ou acima_de/],
    ['número como texto', (c) => { c.analitos.x.limite_critico.acima_de = '9'; }, /abaixo_de e\/ou acima_de/],
    ['limites invertidos', (c) => { c.analitos.x.limite_critico.abaixo_de = 10; }, /maior ou igual/],
    ['sem unidade', (c) => { delete c.analitos.x.limite_critico.unidade; }, /sem a unidade/],
    ['sem limite e sem motivo', (c) => { c.analitos.x.limite_critico = null; }, /não explica o porquê/],
    ['sem unidades_aceitas', (c) => { delete c.analitos.x.unidades_aceitas; }, /unidades_aceitas/],
  ];
  for (const [nome, estragar, mensagem] of erros) {
    it(`${nome} → erro`, () => {
      const config = base();
      estragar(config);
      assert.throws(() => validarLimitesCriticos(config), mensagem);
    });
  }
  it('o exemplo mínimo válido passa', () => assert.doesNotThrow(() => validarLimitesCriticos(base())));
});

describe('classificarAnalito: classificação + alerta + fonte juntos', () => {
  it('glicose 38 mg/dL em "70 a 99" → abaixo e crítico', () => {
    const r = classificarAnalito({ id_canonico: 'glicose', valor: 38, unidade: 'mg/dL', faixa_referencia: interpretarFaixa('70 a 99') }, limites);
    assert.equal(r.classificacao, 'abaixo');
    assert.equal(r.motivo_sem_classificacao, null);
    assert.equal(r.alerta_critico, true);
    assert.equal(r.limite_critico.fonte.id, 'pncq_2019');
  });
  it('alerta não depende da faixa do laudo: segue o limite com fonte', () => {
    // Faixa impressa estranha (até 500), mas 486 > 450 continua crítico.
    const r = classificarAnalito({ id_canonico: 'glicose', valor: 486, unidade: 'mg/dL', faixa_referencia: interpretarFaixa('70 a 500') }, limites);
    assert.deepEqual([r.classificacao, r.alerta_critico], ['dentro', true]);
  });
});
