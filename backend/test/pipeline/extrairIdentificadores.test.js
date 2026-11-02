// Identificadores do cabeçalho do laudo (BWL-07). Rodar: npm test.
// Só laudos e pacientes FICTÍCIOS.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extrairIdentificadores } from '../../src/pipeline/extrairIdentificadores.js';

const PASTA_TEXTOS = join(import.meta.dirname, '..', '..', '..', 'samples', 'laudos', 'texto_extraido');

describe('extrairIdentificadores: laudos sintéticos de samples/', () => {
  for (const arquivo of readdirSync(PASTA_TEXTOS).filter((a) => a.endsWith('.txt'))) {
    it(`${arquivo}: lê paciente, CPF, nascimento, pedido, médico e CRM`, () => {
      const id = extrairIdentificadores(readFileSync(join(PASTA_TEXTOS, arquivo), 'utf8'));
      assert.equal(id.paciente, 'Maria Teste da Silva');
      assert.equal(id.cpf, '000.000.000-00');
      assert.equal(id.nascimento, '14/03/1992');
      assert.match(id.pedido, /^TESTE-\d{4}$/);
      assert.equal(id.medico, 'João Exemplo Fictício');
      assert.equal(id.crm, 'FICTÍCIO');
      assert.ok(['Ana Exemplo', 'Carlos Modelo'].includes(id.responsavel_tecnico));
    });
  }
});

describe('extrairIdentificadores: cabeçalho com formatos realistas (fictício)', () => {
  const CABECALHO = [
    'Paciente: Lúcia Fictícia Andrade Teste  RG: 12.345.678-9',
    'CPF: 123.456.789-09 Data de nascimento: 05/07/1988 Sexo: Feminino',
    'Protocolo: 2026-778899',
    'Médico solicitante: Dra. Helena Modelo Fictícia - CRM/SP 123456',
    'Glicose em jejum 118 mg/dL 70 a 99',
  ].join('\n');

  it('cada rótulo vira um campo; o valor termina no próximo rótulo da linha', () => {
    assert.deepEqual(extrairIdentificadores(CABECALHO), {
      paciente: 'Lúcia Fictícia Andrade Teste',
      cpf: '123.456.789-09',
      rg: '12.345.678-9',
      nascimento: '05/07/1988',
      pedido: '2026-778899',
      medico: 'Helena Modelo Fictícia',
      crm: 'SP 123456',
      responsavel_tecnico: null,
    });
  });
  it('"Prontuário:" e "Atendimento:" também viram pedido', () => {
    assert.equal(extrairIdentificadores('Prontuário: PR-5544').pedido, 'PR-5544');
    assert.equal(extrairIdentificadores('Atendimento: AT-12').pedido, 'AT-12');
  });
  it('fica o 1º valor de cada rótulo (o do cabeçalho)', () => {
    assert.equal(extrairIdentificadores('Paciente: Ana Primeira\nPaciente: Outra Pessoa').paciente, 'Ana Primeira');
  });
  it('"atendimento" sem dois-pontos (nome da unidade) não é rótulo', () => {
    assert.equal(extrairIdentificadores('Unidade Centro Fictício - atendimento de exemplo').pedido, null);
  });
});

describe('extrairIdentificadores: sem cabeçalho', () => {
  it('texto sem rótulos → todos os campos null', () => {
    const id = extrairIdentificadores('Glicose em jejum 88 mg/dL 70 a 99');
    assert.ok(Object.values(id).every((v) => v === null));
  });
  it('texto vazio ou ausente não quebra', () => {
    assert.equal(extrairIdentificadores('').paciente, null);
    assert.equal(extrairIdentificadores(undefined).paciente, null);
  });
});
