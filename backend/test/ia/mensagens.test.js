// Testes das peças da ISA-03/04: schemas, montagem das mensagens e resposta que não é JSON.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESQUEMA_CHAT, ESQUEMA_EXPLICACAO } from '../../src/ia/esquemas.js';
import { montarMensagens } from '../../src/ia/mensagens.js';
import { carregarPrompt } from '../../src/ia/prompts.js';
import { criarClienteIa } from '../../src/ia/index.js';
import { PARTES_EXPLICACAO } from '../../src/seguranca/verificarResposta.js';

const SAMPLES = join(import.meta.dirname, '..', '..', '..', 'samples');
const ENTRADA = JSON.parse(readFileSync(join(SAMPLES, 'entradas-ia', 'explicacao-glicose-normal.json'), 'utf8'));

describe('esquemas e mensagens (ISA-03/04)', () => {
  it('o schema exige exatamente as 5 partes que a segurança confere, na mesma ordem', () => {
    assert.deepEqual(ESQUEMA_EXPLICACAO.required, PARTES_EXPLICACAO);
    assert.deepEqual(Object.keys(ESQUEMA_EXPLICACAO.properties), PARTES_EXPLICACAO);
    assert.deepEqual(ESQUEMA_CHAT.required, ['resposta']);
  });

  it('montarMensagens: system = prompt carregado; user = só a entrada, sem alteração', () => {
    const { system, user } = montarMensagens('explicacao', ENTRADA);
    assert.equal(system, carregarPrompt('explicacao'));
    assert.deepEqual(JSON.parse(user), ENTRADA);
  });

  it('modelo devolve texto que não é JSON → volta o texto como veio', async () => {
    const fetch = async () => new Response(JSON.stringify({ message: { content: 'texto solto' } }));
    const cliente = criarClienteIa({ fetch, baseUrl: 'https://x', apiKey: 'k', modelo: 'm' });
    assert.equal(await cliente.gerarExplicacao(ENTRADA), 'texto solto');
  });
});
