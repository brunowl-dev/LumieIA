// Testes do transporte até o Ollama (ISA-01), sem rede: o fetch é falso.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chamarOllama } from '../../src/ia/ollama.js';

const BASE = { baseUrl: 'https://ollama.exemplo/', apiKey: 'chave-de-teste', modelo: 'gpt-oss:teste', temperatura: 0.2 };
const MENSAGENS = { system: 'instruções', user: '{"dado":1}', format: { type: 'object' } };

function fetchFalso({ corpo, status = 200, texto } = {}) {
  const pedidos = [];
  const fetch = async (url, init) => {
    pedidos.push({ url, init, corpo: JSON.parse(init.body) });
    return new Response(texto ?? JSON.stringify(corpo), { status });
  };
  return { fetch, pedidos };
}

describe('chamarOllama (ISA-01)', () => {
  it('monta o pedido do contrato §4.1 e devolve message.content', async () => {
    const f = fetchFalso({ corpo: { message: { content: 'ok' } } });
    const texto = await chamarOllama({ ...BASE, fetch: f.fetch }, MENSAGENS);
    assert.equal(texto, 'ok');
    const { url, init, corpo } = f.pedidos[0];
    assert.equal(url, 'https://ollama.exemplo/api/chat', 'barra final do baseUrl não duplica');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer chave-de-teste');
    assert.deepEqual(corpo, {
      model: 'gpt-oss:teste',
      messages: [{ role: 'system', content: 'instruções' }, { role: 'user', content: '{"dado":1}' }],
      stream: false,
      format: { type: 'object' },
      options: { temperature: 0.2 },
    });
  });

  it('ignora message.thinking', async () => {
    const f = fetchFalso({ corpo: { message: { content: 'resposta', thinking: 'RACIOCINIO' } } });
    assert.equal(await chamarOllama({ ...BASE, fetch: f.fetch }, MENSAGENS), 'resposta');
  });

  it('temperatura inválida (NaN) não é enviada', async () => {
    const f = fetchFalso({ corpo: { message: { content: 'ok' } } });
    await chamarOllama({ ...BASE, temperatura: Number(undefined), fetch: f.fetch }, MENSAGENS);
    assert.equal(f.pedidos[0].corpo.options, undefined);
  });

  it('HTTP fora de 2xx → erro com o status, e a chave não aparece na mensagem', async () => {
    const f = fetchFalso({ status: 401, texto: 'unauthorized' });
    await assert.rejects(chamarOllama({ ...BASE, fetch: f.fetch }, MENSAGENS), (erro) => {
      assert.match(erro.message, /401/);
      assert.ok(!erro.message.includes('chave-de-teste'));
      assert.equal(erro.cause.message, 'unauthorized');
      return true;
    });
  });

  it('erro de rede → erro com cause, uma chamada só', async () => {
    let chamadas = 0;
    const fetch = async () => { chamadas += 1; throw new TypeError('fetch failed'); };
    await assert.rejects(chamarOllama({ ...BASE, fetch }, MENSAGENS), (erro) => erro.cause instanceof TypeError);
    assert.equal(chamadas, 1);
  });

  it('resposta sem message.content ou que não é JSON → erro', async () => {
    await assert.rejects(chamarOllama({ ...BASE, fetch: fetchFalso({ corpo: { message: {} } }).fetch }, MENSAGENS), /message\.content/);
    await assert.rejects(chamarOllama({ ...BASE, fetch: fetchFalso({ texto: '<html>' }).fetch }, MENSAGENS), /não é JSON/);
  });

  it('configuração faltando → erro antes da rede, citando só o nome da variável', async () => {
    const f = fetchFalso({ corpo: { message: { content: 'ok' } } });
    await assert.rejects(chamarOllama({ ...BASE, apiKey: undefined, fetch: f.fetch }, MENSAGENS), /OLLAMA_API_KEY/);
    assert.equal(f.pedidos.length, 0);
  });
});
