// Sessão em memória (BWL-09). Rodar: npm test. O relógio é falso: sem esperar de verdade.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarSessoes } from '../../src/api/sessao.js';

function relogio() {
  let t = 0;
  return { agora: () => t, avancar: (ms) => { t += ms; } };
}
const LAUDO = { id_laudo: 'l1', analitos: [] };

describe('sessão em memória', () => {
  it('cria e obtém pela id_laudo, com identificadores e mapa vazio', () => {
    const sessoes = criarSessoes({ ttlMs: 1000 });
    sessoes.criar({ laudo: LAUDO, identificadores: { paciente: 'Fulana Fictícia' } });
    const s = sessoes.obter('l1');
    assert.equal(s.identificadores.paciente, 'Fulana Fictícia');
    assert.deepEqual(s.mapa, {});
  });
  it('id desconhecido → null', () => assert.equal(criarSessoes({ ttlMs: 1000 }).obter('x'), null));
  it('expira depois do TTL sem uso, e é APAGADA (identificadores somem)', () => {
    const r = relogio();
    const sessoes = criarSessoes({ ttlMs: 1000, agora: r.agora });
    sessoes.criar({ laudo: LAUDO, identificadores: {} });
    r.avancar(1001);
    assert.equal(sessoes.obter('l1'), null);
    assert.equal(sessoes.quantidade, 0);
  });
  it('cada acesso renova o prazo (a conversa não cai no meio)', () => {
    const r = relogio();
    const sessoes = criarSessoes({ ttlMs: 1000, agora: r.agora });
    sessoes.criar({ laudo: LAUDO, identificadores: {} });
    r.avancar(800); assert.ok(sessoes.obter('l1'));
    r.avancar(800); assert.ok(sessoes.obter('l1'));
  });
  it('limparExpiradas apaga quem ninguém pediu de novo', () => {
    const r = relogio();
    const sessoes = criarSessoes({ ttlMs: 1000, agora: r.agora });
    sessoes.criar({ laudo: LAUDO, identificadores: {} });
    sessoes.criar({ laudo: { id_laudo: 'l2', analitos: [] }, identificadores: {} });
    r.avancar(1001);
    sessoes.limparExpiradas();
    assert.equal(sessoes.quantidade, 0);
  });
  it('histórico separado por exame', () => {
    const sessoes = criarSessoes({ ttlMs: 1000 });
    const s = sessoes.criar({ laudo: LAUDO, identificadores: {} });
    sessoes.historico(s, 'glicose').push({ papel: 'paciente', texto: 'oi' });
    assert.equal(sessoes.historico(s, 'glicose').length, 1);
    assert.equal(sessoes.historico(s, 'tsh').length, 0);
  });
});
