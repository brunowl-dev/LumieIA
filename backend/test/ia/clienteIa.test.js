// Testes de ACEITAÇÃO do cliente da IA (contrato §4). Rodar: npm test.
// Escritos antes da implementação: os marcados com { todo } ainda não passam.
// Ao implementar cada passo de src/ia/CLAUDE.md, tire o `todo` do teste
// correspondente e faça-o passar SEM mudar o que ele confere.
//
// Nenhum teste usa rede: o fetch é falso e responde como o Ollama (/api/chat).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarClienteIa } from '../../src/ia/index.js';
import { verificarChat, verificarExplicacao } from '../../src/seguranca/verificarResposta.js';

const SAMPLES = join(import.meta.dirname, '..', '..', '..', 'samples');
const ler = (caminho) => JSON.parse(readFileSync(join(SAMPLES, caminho), 'utf8'));

const ENTRADA_EXPLICACAO = ler('entradas-ia/explicacao-glicose-normal.json');
const ENTRADA_CHAT = ler('entradas-ia/chat-glicose.json');
const EXPLICACAO_BOA = (({ id_canonico, ...partes }) => partes)(ler('respostas-ia/aprovada-glicose-normal.json'));
const CHAT_BOM = ler('respostas-ia/chat-aprovada.json');

const OPCOES = { baseUrl: 'https://ollama.exemplo', apiKey: 'chave-de-teste', modelo: 'gpt-oss:teste', temperatura: 0.2 };

// fetch falso: guarda cada pedido e responde no formato do Ollama.
function fetchFalso({ conteudo, status = 200, thinking } = {}) {
  const pedidos = [];
  const fetch = async (url, init = {}) => {
    pedidos.push({ url: String(url), init, corpo: JSON.parse(init.body) });
    const corpo = { model: OPCOES.modelo, message: { role: 'assistant', content: conteudo, ...(thinking ? { thinking } : {}) }, done: true };
    return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, pedidos };
}

describe('cliente da IA: forma (contrato §4.0)', () => {
  it('criarClienteIa devolve gerarExplicacao e responderChat', () => {
    const cliente = criarClienteIa({ ...OPCOES, fetch: fetchFalso().fetch });
    assert.equal(typeof cliente.gerarExplicacao, 'function');
    assert.equal(typeof cliente.responderChat, 'function');
  });
});

describe('cliente da IA: explicação (ISA-01 a ISA-04)', () => {
  it('chama POST {baseUrl}/api/chat com chave, modelo, sem stream e com format', { todo: 'ISA-04' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    await criarClienteIa({ ...OPCOES, fetch: f.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO);
    assert.equal(f.pedidos.length, 1);
    const { url, init, corpo } = f.pedidos[0];
    assert.equal(url, 'https://ollama.exemplo/api/chat');
    assert.equal(init.method, 'POST');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer chave-de-teste');
    assert.equal(corpo.model, 'gpt-oss:teste');
    assert.equal(corpo.stream, false);
    assert.ok(corpo.format && typeof corpo.format === 'object', 'format deve ser o JSON Schema das 5 partes');
    assert.equal(corpo.options?.temperature, 0.2);
  });

  it('manda o prompt como system e a entrada (e só ela) como user', { todo: 'ISA-04' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    await criarClienteIa({ ...OPCOES, fetch: f.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO);
    const [system, user, ...resto] = f.pedidos[0].corpo.messages;
    assert.equal(system.role, 'system');
    assert.ok(system.content.length > 200, 'o prompt da explicação deve vir de prompts/v1/explicacao.md');
    assert.equal(user.role, 'user');
    assert.deepEqual(JSON.parse(user.content), ENTRADA_EXPLICACAO);
    assert.equal(resto.length, 0);
  });

  it('devolve as 5 partes como objeto, e a resposta boa passa na segurança', { todo: 'ISA-04' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    const r = await criarClienteIa({ ...OPCOES, fetch: f.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO);
    assert.deepEqual(r, EXPLICACAO_BOA);
    assert.deepEqual(verificarExplicacao(r, ENTRADA_EXPLICACAO.analito, ENTRADA_EXPLICACAO.ficha), { aprovada: true, motivos: [] });
  });

  it('ignora o raciocínio do modelo (message.thinking)', { todo: 'ISA-04' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA), thinking: 'RACIOCINIO_INTERNO' });
    const r = await criarClienteIa({ ...OPCOES, fetch: f.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO);
    assert.ok(!JSON.stringify(r).includes('RACIOCINIO_INTERNO'));
  });

  it('JSON incompleto volta como veio (quem reprova é a segurança)', { todo: 'ISA-04' }, async () => {
    const incompleta = { o_que_avalia: 'Mede o açúcar no sangue.' };
    const f = fetchFalso({ conteudo: JSON.stringify(incompleta) });
    const r = await criarClienteIa({ ...OPCOES, fetch: f.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO);
    assert.deepEqual(r, incompleta);
  });
});

describe('cliente da IA: chat (ISA-05)', () => {
  it('devolve { resposta } e manda a entrada do chat (com histórico) como user', { todo: 'ISA-05' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(CHAT_BOM) });
    const r = await criarClienteIa({ ...OPCOES, fetch: f.fetch }).responderChat(ENTRADA_CHAT);
    assert.deepEqual(r, CHAT_BOM);
    assert.deepEqual(verificarChat(r, ENTRADA_CHAT.ficha), { aprovada: true, motivos: [] });
    const [system, user] = f.pedidos[0].corpo.messages;
    assert.equal(system.role, 'system');
    assert.deepEqual(JSON.parse(user.content), ENTRADA_CHAT);
    assert.ok(f.pedidos[0].corpo.format, 'format deve ser o JSON Schema de { resposta }');
  });

  it('o prompt do chat é outro (prompts/v1/chat.md)', { todo: 'ISA-05' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(CHAT_BOM) });
    const cliente = criarClienteIa({ ...OPCOES, fetch: f.fetch });
    await cliente.responderChat(ENTRADA_CHAT);
    const g = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    await criarClienteIa({ ...OPCOES, fetch: g.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO);
    assert.notEqual(f.pedidos[0].corpo.messages[0].content, g.pedidos[0].corpo.messages[0].content);
  });
});

describe('cliente da IA: nova tentativa (ISA-06)', () => {
  it('com motivosReprovacao, o prompt ganha uma instrução por motivo', { todo: 'ISA-06' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    const cliente = criarClienteIa({ ...OPCOES, fetch: f.fetch });
    await cliente.gerarExplicacao(ENTRADA_EXPLICACAO);
    await cliente.gerarExplicacao(ENTRADA_EXPLICACAO, { motivosReprovacao: ['valor_divergente'] });
    await cliente.gerarExplicacao(ENTRADA_EXPLICACAO, { motivosReprovacao: ['valor_divergente', 'termo_veredito'] });
    const [sem, um, dois] = f.pedidos.map((p) => p.corpo.messages.map((m) => m.content).join('\n'));
    assert.ok(um.length > sem.length && dois.length > um.length);
    assert.ok(um.includes('88') && um.includes('70') && um.includes('99'), 'a instrução de valor_divergente cita valor, mínimo e máximo');
  });

  it('a entrada enviada não muda entre tentativas', { todo: 'ISA-06' }, async () => {
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    const cliente = criarClienteIa({ ...OPCOES, fetch: f.fetch });
    await cliente.gerarExplicacao(ENTRADA_EXPLICACAO);
    await cliente.gerarExplicacao(ENTRADA_EXPLICACAO, { motivosReprovacao: ['aviso_ausente'] });
    assert.deepEqual(JSON.parse(f.pedidos[1].corpo.messages.at(-1).content), ENTRADA_EXPLICACAO);
  });
});

describe('cliente da IA: falhas e privacidade (contrato §4.7 e §4.8)', () => {
  it('HTTP diferente de 2xx → lança erro', { todo: 'ISA-04' }, async () => {
    const f = fetchFalso({ conteudo: '', status: 500 });
    await assert.rejects(criarClienteIa({ ...OPCOES, fetch: f.fetch }).gerarExplicacao(ENTRADA_EXPLICACAO));
  });

  it('erro de rede → lança erro (sem tentar de novo)', { todo: 'ISA-04' }, async () => {
    let chamadas = 0;
    const fetch = async () => { chamadas += 1; throw new TypeError('fetch failed'); };
    await assert.rejects(criarClienteIa({ ...OPCOES, fetch }).gerarExplicacao(ENTRADA_EXPLICACAO));
    assert.equal(chamadas, 1);
  });

  it('não escreve nada no console (entrada e resposta são dados de saúde)', { todo: 'ISA-04' }, async (t) => {
    const log = t.mock.method(console, 'log');
    const erro = t.mock.method(console, 'error');
    const f = fetchFalso({ conteudo: JSON.stringify(EXPLICACAO_BOA) });
    const cliente = criarClienteIa({ ...OPCOES, fetch: f.fetch });
    await cliente.gerarExplicacao(ENTRADA_EXPLICACAO);
    await cliente.responderChat(ENTRADA_CHAT).catch(() => {});
    assert.equal(log.mock.callCount() + erro.mock.callCount(), 0);
  });
});
