// Log só com códigos e números (BWL-07). Rodar: npm test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarRegistrador } from '../../src/seguranca/registrarEvento.js';
import { encontrarIdentificadores } from './pacienteSintetico.js';

function registradorDeTeste() {
  const linhas = [];
  const registrar = criarRegistrador({ escrever: (l) => linhas.push(l), agora: () => new Date('2026-11-02T12:00:00Z') });
  return { linhas, registrar };
}

describe('registrarEvento', () => {
  it('códigos e números conhecidos são escritos', () => {
    const { linhas, registrar } = registradorDeTeste();
    registrar('EXPLICACAO_ENTREGUE', { id_canonico: 'glicose', origem_texto: 'modelo', tentativas_regeneracao: 1, motivos: ['aviso_ausente'] });
    assert.deepEqual(JSON.parse(linhas[0]), {
      momento: '2026-11-02T12:00:00.000Z', evento: 'EXPLICACAO_ENTREGUE',
      id_canonico: 'glicose', origem_texto: 'modelo', tentativas_regeneracao: 1, motivos: ['aviso_ausente'],
    });
  });
  it('texto livre num campo de código é DESCARTADO', () => {
    const { linhas, registrar } = registradorDeTeste();
    registrar('CHAT_RESPONDIDO', { motivo: 'Lúcia Andrade, CPF 123.456.789-09' });
    assert.deepEqual(encontrarIdentificadores(linhas[0]), []);
    assert.equal(JSON.parse(linhas[0]).campos_descartados, 1);
  });
  it('campo fora da lista (ex.: "mensagem") é DESCARTADO', () => {
    const { linhas, registrar } = registradorDeTeste();
    registrar('CHAT_RESPONDIDO', { mensagem: 'meu e-mail é lucia.andrade@exemplo.com', texto: 'x' });
    assert.deepEqual(encontrarIdentificadores(linhas[0]), []);
    assert.equal(JSON.parse(linhas[0]).campos_descartados, 2);
  });
  it('CPF ou telefone como NÚMERO não passam (7 dígitos ou mais)', () => {
    const { linhas, registrar } = registradorDeTeste();
    registrar('LAUDO_PROCESSADO', { analitos: 12345678909, duracao_ms: 999876543 });
    assert.equal(JSON.parse(linhas[0]).campos_descartados, 2);
  });
  it('evento desconhecido vira EVENTO_DESCONHECIDO (o nome não é escrito)', () => {
    const { linhas, registrar } = registradorDeTeste();
    registrar('Paciente Lúcia Andrade', {});
    assert.equal(JSON.parse(linhas[0]).evento, 'EVENTO_DESCONHECIDO');
  });
  it('nunca lança erro (log não derruba a requisição)', () => {
    const registrar = criarRegistrador({ escrever: () => { throw new Error('disco cheio'); } });
    assert.doesNotThrow(() => registrar('LAUDO_PROCESSADO', { analitos: 1 }));
  });
});
