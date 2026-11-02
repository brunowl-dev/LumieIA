// Testes da BWL-03 (estruturação por analito). Rodar: npm test
// Entrada são strings de texto (fixtures), não PDFs. Só dados sintéticos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  converterNumeroBR,
  estruturarAnalitos,
  interpretarFaixa,
} from '../../src/pipeline/estruturarAnalitos.js';

const PASTA_LAUDOS = join(import.meta.dirname, '..', '..', '..', 'samples', 'laudos');
const gabarito = JSON.parse(readFileSync(join(PASTA_LAUDOS, 'gabarito.json'), 'utf8'));
const pdfsDigitais = gabarito.laudos.filter((laudo) => laudo.tipo === 'pdf_digital');
// Texto real extraído pela BWL-02 (samples/laudos/texto_extraido/<laudo>.txt).
const lerTextoExtraido = (arquivoPdf) => readFileSync(
  join(PASTA_LAUDOS, 'texto_extraido', arquivoPdf.replace(/\.pdf$/, '.txt')),
  'utf8',
);

// Cabeçalho e rodapé copiados do Layout A sintético (paciente fictício), para
// montar fixtures com a mesma "sujeira" de um laudo de verdade.
const CABECALHO_A = [
  'Laboratório Modelo Lumie (fictício)',
  'Rua Exemplo, 000 - Cidade Fictícia/SP - Tel. (00) 0000-0000',
  'LAUDO DE EXAMES LABORATORIAIS',
  'Paciente: Maria Teste da Silva Pedido nº: TESTE-0001',
  'Sexo: Feminino Idade: 34 anos',
  'Nascimento: 14/03/1992 CPF: 000.000.000-00',
  'Coleta: 20/10/2026 07:40 Liberação: 21/10/2026 15:10',
  'Exame Resultado Unidade Valores de referência',
].join('\n');
const RODAPE_A = 'DOCUMENTO SINTÉTICO, USO EM TESTES Página 1 de 1';
const laudoA = (...linhasDeResultado) => [CABECALHO_A, ...linhasDeResultado, RODAPE_A].join('\n');

describe('converterNumeroBR: vírgula decimal', () => {
  const casos = [
    ['88', 88],
    ['13,8', 13.8],
    ['0,45', 0.45],
    ['7,80', 7.8],
    ['0,9', 0.9],
    ['  2,35  ', 2.35], // espaços em volta são tolerados
  ];
  for (const [impresso, esperado] of casos) {
    it(`"${impresso}" → ${esperado}`, () => {
      assert.equal(converterNumeroBR(impresso), esperado);
    });
  }
});

describe('converterNumeroBR: ponto de milhar', () => {
  const casos = [
    ['1.234,5', 1234.5],
    ['5.000', 5000], // decisão do grupo: ponto + 3 dígitos é milhar
    ['1.234.567', 1234567],
    ['12.500,75', 12500.75],
  ];
  for (const [impresso, esperado] of casos) {
    it(`"${impresso}" → ${esperado}`, () => {
      assert.equal(converterNumeroBR(impresso), esperado);
    });
  }
});

describe('converterNumeroBR: ponto decimal (divergente, convertido)', () => {
  const casos = [
    ['4.5', 4.5],
    ['7.80', 7.8],
    ['0.450', 0.45], // começa com 0: não pode ser milhar
    ['1.2345', 1.2345], // 4 dígitos depois do ponto: não é grupo de milhar
  ];
  for (const [impresso, esperado] of casos) {
    it(`"${impresso}" → ${esperado}`, () => {
      assert.equal(converterNumeroBR(impresso), esperado);
    });
  }
});

describe('converterNumeroBR: não é número reconhecido → null', () => {
  const casos = [
    '', 'abc', '13,8 mg/dL', '1,2,3', ',5', '5,', '1.234.5',
    '12.34,5', '-5', '< 0,5', '1 234', '13.8,5',
  ];
  for (const impresso of casos) {
    it(`"${impresso}" → null`, () => {
      assert.equal(converterNumeroBR(impresso), null);
    });
  }
  it('entrada que não é string → null', () => {
    assert.equal(converterNumeroBR(13.8), null);
    assert.equal(converterNumeroBR(undefined), null);
  });
});

// Atalho: os 4 campos de limite que interessam em cada caso.
const limites = (faixa) => ({
  minimo: faixa.minimo,
  maximo: faixa.maximo,
  minimo_inclusivo: faixa.minimo_inclusivo,
  maximo_inclusivo: faixa.maximo_inclusivo,
});
const intervalo = (minimo, maximo) =>
  ({ minimo, maximo, minimo_inclusivo: true, maximo_inclusivo: true });
const soMaximo = (maximo, inclusivo) =>
  ({ minimo: null, maximo, minimo_inclusivo: null, maximo_inclusivo: inclusivo });
const soMinimo = (minimo, inclusivo) =>
  ({ minimo, maximo: null, minimo_inclusivo: inclusivo, maximo_inclusivo: null });

describe('interpretarFaixa: faixas impressas nos laudos sintéticos (gabarito)', () => {
  const casos = [
    ['70 a 99', intervalo(70, 99)],
    ['12,0 a 16,0', intervalo(12, 16)],
    ['0,45 a 4,50', intervalo(0.45, 4.5)],
    ['0,6 a 1,3', intervalo(0.6, 1.3)],
    ['Inferior a 190', soMaximo(190, false)],
    // Layout B: faixa com a unidade do resultado no fim.
    ['70 a 99 mg/dL', intervalo(70, 99), 'mg/dL'],
    ['12,0 a 16,0 g/dL', intervalo(12, 16), 'g/dL'],
    ['0,45 a 4,50 µUI/mL', intervalo(0.45, 4.5), 'µUI/mL'],
    ['Inferior a 190 mg/dL', soMaximo(190, false), 'mg/dL'],
  ];
  for (const [impresso, esperado, unidade] of casos) {
    it(`"${impresso}"`, () => {
      const faixa = interpretarFaixa(impresso, { unidade });
      assert.equal(faixa.interpretada, true);
      assert.deepEqual(limites(faixa), esperado);
      assert.equal(faixa.texto_original, impresso);
    });
  }
});

describe('interpretarFaixa: outros formatos', () => {
  const casos = [
    ['70 - 99', intervalo(70, 99)],
    ['70-99', intervalo(70, 99)],
    ['70 – 99', intervalo(70, 99)], // meia-risca (U+2013)
    ['de 70 a 99', intervalo(70, 99)],
    ['70 até 99', intervalo(70, 99)],
    ['1.500 a 4.000', intervalo(1500, 4000)],
    ['< 200', soMaximo(200, false)],
    ['<200', soMaximo(200, false)],
    ['Menor que 5,7', soMaximo(5.7, false)],
    ['Abaixo de 5', soMaximo(5, false)],
    ['Até 150', soMaximo(150, true)],
    ['ATÉ 150', soMaximo(150, true)],
    ['<= 150', soMaximo(150, true)],
    ['≤ 150', soMaximo(150, true)],
    ['Menor ou igual a 150', soMaximo(150, true)],
    ['> 40', soMinimo(40, false)],
    ['Superior a 40', soMinimo(40, false)],
    ['Maior que 40', soMinimo(40, false)],
    ['>= 40', soMinimo(40, true)],
    ['≥ 40', soMinimo(40, true)],
    ['Maior ou igual a 40', soMinimo(40, true)],
    ['Desejável: < 200', soMaximo(200, false)],
    ['Valor de referência: 70 a 99 mg/dL', intervalo(70, 99), 'mg/dL'],
    ['4.000 a 11.000 /mm³', intervalo(4000, 11000), '/mm³'],
  ];
  for (const [impresso, esperado, unidade] of casos) {
    it(`"${impresso}"`, () => {
      const faixa = interpretarFaixa(impresso, { unidade });
      assert.equal(faixa.interpretada, true);
      assert.deepEqual(limites(faixa), esperado);
    });
  }

  it('junta espaços repetidos e tabs no texto_original', () => {
    assert.equal(interpretarFaixa('  70   a	99 ').texto_original, '70 a 99');
  });
});

describe('interpretarFaixa: não reconhecida → interpretada false, sem inventar limites', () => {
  const casos = [
    '', 'Negativo', 'Não reagente', 'Ver observação',
    '99 a 70', // invertida
    '70 a', 'a 99', '70 99', // pedaço faltando
    '70 a 1.234.5', // número inválido
    'Homens: 13,5 a 17,5 Mulheres: 12,0 a 16,0', // duas faixas no mesmo texto
    '< 200 ou > 400',
    '200 a 239 limítrofe', // só a unidade do resultado é tirada, nenhuma outra palavra
    '70 a 99 mg/dL', // unidade não informada: não sabemos que "mg/dL" é unidade
  ];
  for (const impresso of casos) {
    it(`"${impresso}"`, () => {
      const faixa = interpretarFaixa(impresso);
      assert.equal(faixa.interpretada, false);
      assert.deepEqual(limites(faixa), soMinimo(null, null));
      assert.equal(faixa.texto_original, impresso);
    });
  }
});

describe('estruturarAnalitos: texto REAL extraído dos PDFs da BWL-02 x gabarito', () => {
  for (const laudo of pdfsDigitais) {
    it(`${laudo.arquivo} (layout ${laudo.layout})`, () => {
      const { analitos, nao_interpretadas } = estruturarAnalitos(lerTextoExtraido(laudo.arquivo));

      // Cabeçalho e rodapé (paciente, CPF, datas, endereço) não viram nada.
      assert.deepEqual(nao_interpretadas, []);
      assert.equal(analitos.length, laudo.analitos.length);
      laudo.analitos.forEach((esperado, i) => {
        const lido = analitos[i];
        // Layout B imprime "GLICOSE EM JEJUM": o nome vem como está no laudo e
        // quem normaliza é a BWL-04. Aqui comparamos sem diferenciar maiúsculas.
        assert.equal(lido.nome_no_laudo.toLowerCase(), esperado.nome.toLowerCase());
        assert.equal(lido.valor, esperado.valor);
        assert.equal(lido.valor_impresso, esperado.valor_impresso);
        assert.equal(lido.unidade, esperado.unidade);
        assert.equal(lido.faixa_referencia.texto_original, esperado.faixa_impressa);
        assert.equal(lido.faixa_referencia.interpretada, true);
        assert.equal(lido.confianca, 1);
        assert.deepEqual(lido.pendencias, []);
      });
    });
  }

  it('painel_misto_layoutB.pdf: limites das faixas', () => {
    const { analitos } = estruturarAnalitos(lerTextoExtraido('painel_misto_layoutB.pdf'));
    assert.deepEqual(analitos.map((a) => limites(a.faixa_referencia)), [
      intervalo(70, 99),
      intervalo(12, 16),
      intervalo(0.45, 4.5),
      soMaximo(190, false), // "Inferior a 190 mg/dL": o 190 fica de fora
    ]);
  });
});

describe('estruturarAnalitos: números', () => {
  it('vírgula decimal', () => {
    const [analito] = estruturarAnalitos(laudoA('Hemoglobina 13,8 g/dL 12,0 a 16,0')).analitos;
    assert.equal(analito.valor, 13.8);
    assert.equal(analito.valor_impresso, '13,8');
    assert.deepEqual(limites(analito.faixa_referencia), intervalo(12, 16));
  });

  it('ponto de milhar no valor e na faixa', () => {
    const { analitos } = estruturarAnalitos(laudoA(
      'Leucócitos 5.000 /mm³ 4.000 a 11.000',
      'Exame Fictício 1.234,5 U/L 1.000 a 2.000',
    ));
    assert.equal(analitos[0].valor, 5000);
    assert.equal(analitos[0].unidade, '/mm³');
    assert.deepEqual(limites(analitos[0].faixa_referencia), intervalo(4000, 11000));
    assert.equal(analitos[1].valor, 1234.5);
    assert.deepEqual(limites(analitos[1].faixa_referencia), intervalo(1000, 2000));
  });
});

describe('estruturarAnalitos: formatos de faixa numa linha de tabela', () => {
  const casos = [
    ['Glicose em jejum 88 mg/dL 70 a 99', intervalo(70, 99)],
    ['Glicose em jejum 88 mg/dL 70 - 99', intervalo(70, 99)],
    ['Glicose em jejum 88 mg/dL 70 – 99', intervalo(70, 99)],
    ['Colesterol total 172 mg/dL < 200', soMaximo(200, false)],
    ['Colesterol total 172 mg/dL Desejável: < 200', soMaximo(200, false)],
    ['HDL 52 mg/dL > 40', soMinimo(40, false)],
    ['Triglicerídeos 120 mg/dL Até 150', soMaximo(150, true)],
  ];
  for (const [linha, esperado] of casos) {
    it(`"${linha}"`, () => {
      const { analitos, nao_interpretadas } = estruturarAnalitos(laudoA(linha));
      assert.equal(analitos.length, 1);
      assert.deepEqual(limites(analitos[0].faixa_referencia), esperado);
      assert.deepEqual(nao_interpretadas, []);
    });
  }
});

describe('estruturarAnalitos: campo faltando → analito com confiança menor', () => {
  it('unidade ausente', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em jejum 88 70 a 99')).analitos;
    assert.equal(analito.unidade, null);
    assert.equal(analito.faixa_referencia.interpretada, true);
    assert.equal(analito.confianca, 0.75);
    assert.deepEqual(analito.pendencias, ['unidade_ausente']);
  });

  it('faixa ausente', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em jejum 88 mg/dL')).analitos;
    assert.equal(analito.unidade, 'mg/dL');
    assert.equal(analito.confianca, 0.75);
    assert.deepEqual(analito.pendencias, ['faixa_ausente']);
  });

  it('faixa em formato não reconhecido: guarda o texto, não inventa limites', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em jejum 88 mg/dL Ver observação')).analitos;
    assert.equal(analito.faixa_referencia.texto_original, 'Ver observação');
    assert.equal(analito.faixa_referencia.interpretada, false);
    assert.equal(analito.faixa_referencia.minimo, null);
    assert.equal(analito.faixa_referencia.maximo, null);
    assert.equal(analito.confianca, 0.75);
    assert.deepEqual(analito.pendencias, ['faixa_nao_interpretada']);
  });
});

describe('estruturarAnalitos: linhas que parecem resultado → nao_interpretadas', () => {
  const casos = [
    ['Glicose em jejum ##8 mg/dL 70 a 99', 'formato_nao_reconhecido'], // lixo de OCR
    ['Glicose em jejum 1l8 mg/dL 70 a 99', 'formato_nao_reconhecido'], // "l" no lugar de "1"
    ['Glicose em jejum mg/dL 70 a 99', 'formato_nao_reconhecido'], // valor ausente
    ['Glicose em jejum 1.234.5 mg/dL 70 a 99', 'valor_invalido'],
    ['PCR < 0,5 mg/dL Inferior a 1,0', 'valor_com_sinal'],
    ['Glicose em jejum 88', 'unidade_e_faixa_ausentes'],
    ['T4 livre 1,2 ng/dL 0,7 a 1,8', 'formato_nao_reconhecido'], // número no nome
  ];
  for (const [linha, motivo] of casos) {
    it(`"${linha}" → ${motivo}`, () => {
      const { analitos, nao_interpretadas } = estruturarAnalitos(laudoA(linha));
      assert.deepEqual(analitos, []);
      assert.deepEqual(nao_interpretadas, [{ linha, motivo }]);
    });
  }

  it('não descarta as linhas vizinhas boas', () => {
    const { analitos, nao_interpretadas } = estruturarAnalitos(laudoA(
      'Glicose em jejum 88 mg/dL 70 a 99',
      'Hemoglobina 1#,8 g/dL 12,0 a 16,0',
      'TSH 2,35 µUI/mL 0,45 a 4,50',
    ));
    assert.deepEqual(analitos.map((a) => a.nome_no_laudo), ['Glicose em jejum', 'TSH']);
    assert.equal(nao_interpretadas.length, 1);
    assert.equal(nao_interpretadas[0].linha, 'Hemoglobina 1#,8 g/dL 12,0 a 16,0');
  });
});

describe('estruturarAnalitos: cabeçalho, rodapé e layout', () => {
  it('cabeçalho e rodapé sem resultado não viram analito nem nao_interpretadas', () => {
    assert.deepEqual(estruturarAnalitos(laudoA()), { analitos: [], nao_interpretadas: [] });
  });

  it('texto vazio ou que não é string', () => {
    assert.deepEqual(estruturarAnalitos(''), { analitos: [], nao_interpretadas: [] });
    assert.deepEqual(estruturarAnalitos(undefined), { analitos: [], nao_interpretadas: [] });
  });

  it('tabs e espaços múltiplos entre as colunas', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em jejum\t\t88   mg/dL\t70  a  99')).analitos;
    assert.equal(analito.nome_no_laudo, 'Glicose em jejum');
    assert.equal(analito.valor, 88);
    assert.equal(analito.unidade, 'mg/dL');
    assert.equal(analito.faixa_referencia.texto_original, '70 a 99');
  });

  it('quebra de linha entre o nome e o valor', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em jejum', '88 mg/dL 70 a 99')).analitos;
    assert.equal(analito.nome_no_laudo, 'Glicose em jejum');
    assert.equal(analito.valor, 88);
  });

  it('valor sem nome nenhum acima → nao_interpretadas', () => {
    const { analitos, nao_interpretadas } = estruturarAnalitos(
      'Coleta: 20/10/2026 07:40\n88 mg/dL 70 a 99',
    );
    assert.deepEqual(analitos, []);
    assert.deepEqual(nao_interpretadas, [{ linha: '88 mg/dL 70 a 99', motivo: 'nome_nao_encontrado' }]);
  });

  it('nome com acento e parênteses', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose (jejum) 88 mg/dL 70 a 99')).analitos;
    assert.equal(analito.nome_no_laudo, 'Glicose (jejum)');
  });

  it('unidade como impressa, mesmo com "μ" grego vindo de OCR', () => {
    const [analito] = estruturarAnalitos(laudoA('TSH 2,35 μUI/mL 0,45 a 4,50')).analitos;
    assert.equal(analito.unidade, 'μUI/mL');
  });

  it('Layout B: "Resultado:" sem valor → valor_ausente', () => {
    const { nao_interpretadas } = estruturarAnalitos('GLICOSE EM JEJUM\nResultado: mg/dL');
    assert.deepEqual(nao_interpretadas, [{ linha: 'Resultado: mg/dL', motivo: 'valor_ausente' }]);
  });

  it('Layout B: faixa na mesma linha do resultado', () => {
    const [analito] = estruturarAnalitos('GLICOSE EM JEJUM\nResultado: 88 mg/dL 70 a 99').analitos;
    assert.equal(analito.valor, 88);
    assert.deepEqual(limites(analito.faixa_referencia), intervalo(70, 99));
  });

  it('Layout B: "Valor de referência" sem resultado antes → nao_interpretadas', () => {
    const { analitos, nao_interpretadas } = estruturarAnalitos('Valor de referência: 70 a 99 mg/dL');
    assert.deepEqual(analitos, []);
    assert.equal(nao_interpretadas[0].motivo, 'formato_nao_reconhecido');
  });
});

describe('estruturarAnalitos: várias faixas por categoria (Tabelas 1 e 2 do artigo)', () => {
  // Laudo da Tabela 1 do artigo, com cabeçalho e rodapé sintéticos em volta.
  const TABELA_1 = [
    'Nome: Maria Teste da Silva Sexo: Feminino Idade: 34 anos',
    'Data da coleta: 20/10/2026 07:40',
    'GLICOSE (jejum)',
    'Resultado: 112 mg/dL',
    'Valores de referência:',
    'Normal: inferior a 100 mg/dL',
    'Glicemia de jejum alterada: 100 a 125 mg/dL',
    'Diabetes: igual ou superior a 126 mg/dL',
    'Liberado eletronicamente por: Dr. Carlos Modelo (fictício)',
  ].join('\n');

  it('usa a faixa "Normal" e guarda as outras categorias (Tabela 2)', () => {
    const { analitos, nao_interpretadas } = estruturarAnalitos(TABELA_1);
    assert.deepEqual(nao_interpretadas, []);
    assert.equal(analitos.length, 1);
    const [glicose] = analitos;
    assert.equal(glicose.nome_no_laudo, 'GLICOSE (jejum)');
    assert.equal(glicose.valor, 112);
    assert.equal(glicose.unidade, 'mg/dL');
    assert.deepEqual(limites(glicose.faixa_referencia), soMaximo(100, false));
    assert.equal(glicose.faixa_referencia.texto_original, 'Normal: inferior a 100 mg/dL');
    assert.deepEqual(glicose.outras_faixas, [
      'Glicemia de jejum alterada: 100 a 125 mg/dL',
      'Diabetes: igual ou superior a 126 mg/dL',
    ]);
    assert.equal(glicose.confianca, 1);
  });

  it('sem categoria "Normal": não escolhe uma faixa por conta própria', () => {
    const { analitos, nao_interpretadas } = estruturarAnalitos([
      'COLESTEROL TOTAL',
      'Resultado: 172 mg/dL',
      'Valores de referência:',
      'Limítrofe: 190 a 239 mg/dL',
      'Alto: igual ou superior a 240 mg/dL',
    ].join('\n'));
    assert.deepEqual(nao_interpretadas, []); // as linhas ficam no texto da faixa, não somem
    assert.equal(analitos[0].faixa_referencia.interpretada, false);
    assert.equal(
      analitos[0].faixa_referencia.texto_original,
      'Limítrofe: 190 a 239 mg/dL; Alto: igual ou superior a 240 mg/dL',
    );
    assert.deepEqual(analitos[0].pendencias, ['faixa_nao_interpretada']);
  });

  it('"Igual ou superior a" e "Igual ou inferior a"', () => {
    assert.deepEqual(limites(interpretarFaixa('Igual ou superior a 126')), soMinimo(126, true));
    assert.deepEqual(limites(interpretarFaixa('Igual ou inferior a 99')), soMaximo(99, true));
  });

  it('analitos de linha única têm outras_faixas vazia', () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em jejum 88 mg/dL 70 a 99')).analitos;
    assert.deepEqual(analito.outras_faixas, []);
  });
});

// Casos em que o parser ERRA hoje. Ficam como "todo": rodam e aparecem no
// relatório, mas não quebram o npm test. Documentados como limites conhecidos.
describe('estruturarAnalitos: limites conhecidos', () => {
  it('nome quebrado em duas linhas fica só com o pedaço de baixo', { todo: 'limite conhecido' }, () => {
    const [analito] = estruturarAnalitos(laudoA('Glicose em', 'jejum 88 mg/dL 70 a 99')).analitos;
    assert.equal(analito.nome_no_laudo, 'Glicose em jejum'); // hoje sai "jejum"
  });

  it('valor sem nome logo abaixo do cabeçalho da tabela usa o cabeçalho como nome', { todo: 'limite conhecido' }, () => {
    const { analitos } = estruturarAnalitos(laudoA('88 mg/dL 70 a 99'));
    assert.deepEqual(analitos, []); // hoje sai nome "Exame Resultado Unidade Valores de referência"
  });
});
