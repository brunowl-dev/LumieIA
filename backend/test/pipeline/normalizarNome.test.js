// Testes da BWL-04 (nome do exame → id_canonico). Rodar: npm test
// Usa a base real (docs/base-conhecimento/exames.json) e bases mínimas em string.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  carregarIndiceDeNomes,
  criarIndiceDeNomes,
  normalizarNomeExame,
  normalizarTexto,
} from '../../src/pipeline/normalizarNome.js';
import { estruturarAnalitos } from '../../src/pipeline/estruturarAnalitos.js';

const RAIZ = join(import.meta.dirname, '..', '..', '..');
const PASTA_LAUDOS = join(RAIZ, 'samples', 'laudos');
const indice = carregarIndiceDeNomes(join(RAIZ, 'docs', 'base-conhecimento', 'exames.json'));
const gabarito = JSON.parse(readFileSync(join(PASTA_LAUDOS, 'gabarito.json'), 'utf8'));

// Mapa nome no gabarito → id esperado (os 5 exames do protótipo, GRP-02).
const ID_ESPERADO = {
  'Glicose em jejum': 'glicose',
  'Hemoglobina': 'hemoglobina',
  'TSH': 'tsh',
  'Colesterol total': 'colesterol_total',
  'Creatinina': 'creatinina',
};

describe('normalizarTexto', () => {
  const casos = [
    ['Glicose em jejum', 'glicose em jejum'],
    ['GLICOSE EM JEJUM', 'glicose em jejum'], // maiúsculas
    ['  Glicose   em\tjejum  ', 'glicose em jejum'], // espaços extras
    ['Glicose em jejum.', 'glicose em jejum'], // pontuação
    ['Glicose - jejum', 'glicose jejum'],
    ['Hemoglobina (Hb)', 'hemoglobina hb'],
    ['Hormônio tireoestimulante', 'hormonio tireoestimulante'], // acento
    ['CREATININA SÉRICA', 'creatinina serica'],
    ['T4 livre', 't4 livre'], // dígitos ficam
  ];
  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" → "${esperado}"`, () => assert.equal(normalizarTexto(entrada), esperado));
  }
  it('o que não é texto vira ""', () => {
    assert.equal(normalizarTexto(null), '');
    assert.equal(normalizarTexto(42), '');
  });
});

describe('normalizarNomeExame: base real', () => {
  const casos = [
    ['Glicose em jejum', 'glicose'],
    ['GLICEMIA JEJUM', 'glicose'],
    ['Glicemia', 'glicose'],
    ['glicemia de jejum', 'glicose'],
    ['Glicose (jejum)', 'glicose'], // parênteses viram espaço → "glicose jejum"
    ['COLESTEROL TOTAL', 'colesterol_total'],
    ['colesterol_total', 'colesterol_total'], // o próprio id vale como nome
    ['Creatinina Sérica', 'creatinina'],
    ['TSH ultrassensível', 'tsh'],
    ['hormonio tireoestimulante', 'tsh'], // sem acento
    ['HGB', 'hemoglobina'],
    ['Hemoglobina (Hb)', 'hemoglobina'],
  ];
  for (const [nome, id] of casos) {
    it(`"${nome}" → ${id}`, () => {
      assert.deepEqual(normalizarNomeExame(nome, indice), {
        reconhecido: true, id_canonico: id, nome_normalizado: normalizarTexto(nome),
      });
    });
  }
});

describe('normalizarNomeExame: sem correspondência → não reconhecido, sem erro', () => {
  // Nenhum destes é adivinhado: só nome exato (depois de normalizar) vale.
  const casos = [
    'Ureia', // exame fora da base
    'Glicose pós-prandial', // outro exame, apesar de começar com "Glicose"
    'Glicoze em jejum', // erro de digitação/OCR
    'Colesterol HDL', // parecido com colesterol, mas é outro exame
    'Hemograma',
    '',
  ];
  for (const nome of casos) {
    it(`"${nome}"`, () => {
      const resultado = normalizarNomeExame(nome, indice);
      assert.equal(resultado.reconhecido, false);
      assert.equal(resultado.id_canonico, null);
    });
  }
  it('entrada que não é texto', () => {
    assert.equal(normalizarNomeExame(undefined, indice).id_canonico, null);
  });
});

describe('normalizarNomeExame: nomes reais dos laudos sintéticos (texto extraído)', () => {
  for (const laudo of gabarito.laudos.filter((l) => l.tipo === 'pdf_digital')) {
    it(laudo.arquivo, () => {
      const texto = readFileSync(join(PASTA_LAUDOS, 'texto_extraido', laudo.arquivo.replace(/\.pdf$/, '.txt')), 'utf8');
      const ids = estruturarAnalitos(texto).analitos.map((a) => normalizarNomeExame(a.nome_no_laudo, indice).id_canonico);
      assert.deepEqual(ids, laudo.analitos.map((a) => ID_ESPERADO[a.nome]));
    });
  }
});

describe('criarIndiceDeNomes: validação da base', () => {
  it('usa também fichas "pendente" (reconhecer não depende da revisão do texto)', () => {
    const indiceMinimo = criarIndiceDeNomes({
      exames: [{ id_canonico: 'glicose', nomes_alternativos: ['Glicemia'], status: 'pendente' }],
    });
    assert.equal(normalizarNomeExame('glicemia', indiceMinimo).id_canonico, 'glicose');
  });
  it('base sem a lista "exames" → erro claro', () => {
    assert.throws(() => criarIndiceDeNomes({}), /falta a lista "exames"/);
    assert.throws(() => criarIndiceDeNomes(null), /falta a lista "exames"/);
  });
  it('ficha sem id_canonico → erro claro', () => {
    assert.throws(() => criarIndiceDeNomes({ exames: [{ nomes_alternativos: [] }] }), /ficha nº 1 não tem id_canonico/);
  });
  it('ficha sem nomes_alternativos → erro claro', () => {
    assert.throws(() => criarIndiceDeNomes({ exames: [{ id_canonico: 'x' }] }), /"x" não tem a lista nomes_alternativos/);
  });
  it('mesmo nome em duas fichas → erro (seria um chute)', () => {
    const base = {
      exames: [
        { id_canonico: 'glicose', nomes_alternativos: ['Glicemia'] },
        { id_canonico: 'outra', nomes_alternativos: ['GLICEMIA'] },
      ],
    };
    assert.throws(() => criarIndiceDeNomes(base), /aparece em "glicose" e em "outra"/);
  });
  it('arquivo inexistente → erro com o caminho', () => {
    assert.throws(() => carregarIndiceDeNomes(join(RAIZ, 'nao-existe.json')), /Não foi possível ler a base de conhecimento/);
  });
});
