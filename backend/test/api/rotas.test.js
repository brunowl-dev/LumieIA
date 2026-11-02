// Rotas e orquestração (BWL-09), de ponta a ponta por HTTP, com IA FALSA.
// Sobe o servidor numa porta livre e usa fetch + FormData (nativos do Node).
// Rodar: npm test. Só laudos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { carregarFichas, corDoItem, criarApp } from '../../src/api/rotas.js';
import { criarSessoes } from '../../src/api/sessao.js';
import { criarAdaptadorIa } from '../../src/api/adaptadorIa.js';
import { criarIaFalsa } from '../../src/api/iaFalsa.js';
import { criarRegistrador } from '../../src/seguranca/registrarEvento.js';
import { encontrarIdentificadores } from '../seguranca/pacienteSintetico.js';

const RAIZ = join(import.meta.dirname, '..', '..', '..');
const LAUDOS = join(RAIZ, 'samples', 'laudos');
const lerLaudo = (arquivo) => readFileSync(join(LAUDOS, arquivo));
const FICHAS = carregarFichas(join(RAIZ, 'docs', 'base-conhecimento', 'exames.json'));
const LER_RESPOSTA_IA = (arquivo) => JSON.parse(readFileSync(join(RAIZ, 'samples', 'respostas-ia', arquivo), 'utf8'));

// Identificadores impressos nos PDFs sintéticos (paciente fictício).
const IDENTIFICADORES_DOS_PDFS = ['Maria Teste da Silva', 'Maria', '000.000.000-00', '14/03/1992', 'João Exemplo', 'Ana Exemplo', 'Carlos Modelo'];

// Cliente de IA que CAPTURA tudo que recebe e delega para a IA falsa (ou para um roteiro).
function clienteQueCaptura({ explicacoes, chats, atrasoMs = 0, falhar = false } = {}) {
  const falsa = criarIaFalsa();
  const recebidas = [];
  const motivos = [];
  const esperar = () => new Promise((ok) => { setTimeout(ok, atrasoMs); });
  return {
    recebidas,
    motivos,
    async gerarExplicacao(entrada, opcoes) {
      recebidas.push(JSON.stringify(entrada)); motivos.push(opcoes.motivosReprovacao);
      if (falhar) throw new Error('ollama fora do ar');
      if (atrasoMs) await esperar();
      return explicacoes ? explicacoes[Math.min(motivos.length - 1, explicacoes.length - 1)] : falsa.gerarExplicacao(entrada);
    },
    async responderChat(entrada, opcoes) {
      recebidas.push(JSON.stringify(entrada)); motivos.push(opcoes.motivosReprovacao);
      if (falhar) throw new Error('ollama fora do ar');
      return chats ? chats[Math.min(motivos.length - 1, chats.length - 1)] : falsa.responderChat(entrada);
    },
  };
}

// Sobe um servidor de teste; devolve { url, cliente, logs, sessoes, fechar }.
async function subir(opcoesCliente, { timeoutMs = 2000, ttlMs = 60_000 } = {}) {
  const cliente = clienteQueCaptura(opcoesCliente);
  const logs = [];
  const sessoes = criarSessoes({ ttlMs });
  const app = criarApp({
    sessoes,
    adaptador: criarAdaptadorIa({ cliente, timeoutMs }),
    fichas: FICHAS,
    maxRegeneracoes: 2,
    uploadMaxMb: 1,
    registrar: criarRegistrador({ escrever: (l) => logs.push(l) }),
  });
  const servidor = createServer(app);
  await new Promise((ok) => { servidor.listen(0, '127.0.0.1', ok); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  return { url, cliente, logs, sessoes, fechar: () => new Promise((ok) => { servidor.close(ok); }) };
}

async function enviar(url, bytes, nome = 'laudo.pdf') {
  const form = new FormData();
  form.append('arquivo', new Blob([bytes]), nome);
  const r = await fetch(`${url}/api/laudos`, { method: 'POST', body: form });
  return { http: r.status, corpo: await r.json() };
}
async function postar(url, caminho, dados) {
  const r = await fetch(`${url}${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dados) });
  return { http: r.status, corpo: await r.json() };
}

describe('cores (contrato §5.1)', () => {
  it('dentro → verde; acima/abaixo → amarelo; alerta crítico → vermelho', () => {
    assert.equal(corDoItem({ classificacao: 'dentro', alerta_critico: false }), 'verde');
    assert.equal(corDoItem({ classificacao: 'acima', alerta_critico: false }), 'amarelo');
    assert.equal(corDoItem({ classificacao: 'abaixo', alerta_critico: false }), 'amarelo');
    assert.equal(corDoItem({ classificacao: 'abaixo', alerta_critico: true }), 'vermelho');
  });
});

describe('fluxo completo com IA falsa', () => {
  let s;
  before(async () => { s = await subir(); });
  after(() => s.fechar());

  it('saúde', async () => {
    const r = await fetch(`${s.url}/api/saude`);
    assert.deepEqual(await r.json(), { status: 'ok' });
  });

  it('momento 1: PDF → tela de exames (§5.1), sem chamar a IA', async () => {
    const { http, corpo } = await enviar(s.url, lerLaudo('glicose_critico_baixo.pdf'));
    assert.equal(http, 200);
    assert.deepEqual(Object.keys(corpo).sort(), ['aviso_usuario', 'id_laudo', 'itens', 'itens_nao_lidos', 'status']);
    const [item] = corpo.itens;
    assert.deepEqual(
      [item.id_canonico, item.classificacao, item.cor, item.alerta_prioritario, item.explicacao_disponivel],
      ['glicose', 'abaixo', 'vermelho', true, true],
    );
    assert.equal(s.cliente.recebidas.length, 0);
    // Nada do paciente vai para o front.
    assert.deepEqual(encontrarIdentificadores(JSON.stringify(corpo), IDENTIFICADORES_DOS_PDFS), []);
  });

  it('momento 2 e 3: explicação e chat; a IA nunca recebe o nome nem o CPF', async () => {
    const { corpo: tela } = await enviar(s.url, lerLaudo('painel_misto_layoutA.pdf'));
    const glicose = tela.itens.find((i) => i.id_canonico === 'glicose');
    assert.ok(glicose);

    const exp = await postar(s.url, '/api/explicacoes', { id_laudo: tela.id_laudo, id_canonico: 'glicose' });
    assert.equal(exp.http, 200);
    assert.deepEqual(Object.keys(exp.corpo.explicacao), ['o_que_avalia', 'valor_e_posicao', 'significado', 'especialidade', 'aviso']);
    assert.deepEqual([exp.corpo.origem_texto, exp.corpo.tentativas_regeneracao], ['modelo', 0]);

    const chat = await postar(s.url, '/api/chat', {
      id_laudo: tela.id_laudo, id_canonico: 'glicose',
      mensagem: 'Meu nome é Maria Teste da Silva, CPF 00000000000, nasci em 14/03/1992. Por que jejum?',
    });
    assert.equal(chat.http, 200);
    assert.equal(chat.corpo.origem_texto, 'modelo');
    assert.match(chat.corpo.resposta, /não substitui/);

    // Tudo que a IA recebeu, serializado: nenhum identificador.
    assert.ok(s.cliente.recebidas.length >= 2);
    for (const entrada of s.cliente.recebidas) {
      assert.deepEqual(encontrarIdentificadores(entrada, IDENTIFICADORES_DOS_PDFS), []);
    }
    // O histórico da sessão guarda a mensagem já pseudonimizada.
    const sessao = s.sessoes.obter(tela.id_laudo);
    const historico = sessao.chats.get('glicose');
    assert.deepEqual(historico.map((m) => m.papel), ['assistente', 'paciente', 'assistente']);
    assert.deepEqual(encontrarIdentificadores(JSON.stringify(historico), IDENTIFICADORES_DOS_PDFS), []);
  });

  it('o log só tem códigos e números (nenhum identificador)', () => {
    assert.ok(s.logs.length > 0);
    assert.deepEqual(encontrarIdentificadores(s.logs.join('\n'), IDENTIFICADORES_DOS_PDFS), []);
    assert.ok(s.logs.every((l) => !l.includes('campos_descartados')), 'a rota tentou logar campo fora da lista');
  });
});

describe('regeneração pela rota', () => {
  it('reprova 1x e aprova → tentativas_regeneracao 1; a 2ª chamada recebe o motivo', async () => {
    const s = await subir({ explicacoes: [LER_RESPOSTA_IA('reprovada-sem-aviso.json'), LER_RESPOSTA_IA('aprovada.json')] });
    try {
      const { corpo: tela } = await enviar(s.url, lerLaudo('glicose_acima.pdf'));
      const exp = await postar(s.url, '/api/explicacoes', { id_laudo: tela.id_laudo, id_canonico: 'glicose' });
      assert.deepEqual([exp.corpo.origem_texto, exp.corpo.tentativas_regeneracao], ['modelo', 1]);
      assert.deepEqual(s.cliente.motivos, [[], ['parte_ausente', 'aviso_ausente']]);
    } finally { await s.fechar(); }
  });
  it('reprova sempre → mensagem padrão (3 chamadas)', async () => {
    const s = await subir({ explicacoes: [LER_RESPOSTA_IA('reprovada-diagnostico.json')], chats: [LER_RESPOSTA_IA('chat-reprovada-prescricao.json')] });
    try {
      const { corpo: tela } = await enviar(s.url, lerLaudo('glicose_acima.pdf'));
      const exp = await postar(s.url, '/api/explicacoes', { id_laudo: tela.id_laudo, id_canonico: 'glicose' });
      assert.deepEqual([exp.corpo.origem_texto, exp.corpo.tentativas_regeneracao], ['mensagem_padrao', 2]);
      assert.match(exp.corpo.explicacao.valor_e_posicao, /118 mg\/dL.*acima da faixa/);
      const chat = await postar(s.url, '/api/chat', { id_laudo: tela.id_laudo, id_canonico: 'glicose', mensagem: 'Posso tomar remédio?' });
      assert.equal(chat.corpo.origem_texto, 'mensagem_padrao');
      assert.match(chat.corpo.resposta, /^Não consegui responder essa dúvida com segurança/);
      assert.equal(s.cliente.motivos.length, 6);
    } finally { await s.fechar(); }
  });
});

describe('erros (contrato §7)', () => {
  let s;
  before(async () => { s = await subir(); });
  after(() => s.fechar());

  const casos = [
    ['arquivo que não é PDF nem imagem → FORMATO_NAO_SUPORTADO', () => enviar(s.url, Buffer.from('texto qualquer'), 'a.txt'), 415, 'FORMATO_NAO_SUPORTADO'],
    ['foto (OCR ainda não existe) → ARQUIVO_ILEGIVEL', () => enviar(s.url, lerLaudo('foto_glicose_acima.jpg'), 'f.jpg'), 422, 'ARQUIVO_ILEGIVEL'],
    ['PDF só de imagem → ARQUIVO_ILEGIVEL', () => enviar(s.url, lerLaudo('digitalizado_sem_texto.pdf')), 422, 'ARQUIVO_ILEGIVEL'],
    ['PDF com senha → ARQUIVO_ILEGIVEL (pdf_protegido)', () => enviar(s.url, lerLaudo('laudo_protegido.pdf')), 422, 'ARQUIVO_ILEGIVEL'],
    ['PDF com quase tudo ilegível → BAIXA_CONFIANCA', () => enviar(s.url, lerLaudo('painel_maioria_ilegivel.pdf')), 422, 'BAIXA_CONFIANCA'],
    ['arquivo acima de UPLOAD_MAX_MB → ARQUIVO_MUITO_GRANDE', () => enviar(s.url, Buffer.alloc(1.5 * 1024 * 1024, 0x25)), 413, 'ARQUIVO_MUITO_GRANDE'],
    ['id_laudo desconhecido/expirado → SESSAO_EXPIRADA', () => postar(s.url, '/api/explicacoes', { id_laudo: 'nao-existe', id_canonico: 'glicose' }), 410, 'SESSAO_EXPIRADA'],
    ['JSON inválido → REQUISICAO_INVALIDA', () => fetch(`${s.url}/api/chat`, { method: 'POST', body: '{' }).then(async (r) => ({ http: r.status, corpo: await r.json() })), 400, 'REQUISICAO_INVALIDA'],
    ['rota inexistente → ROTA_NAO_ENCONTRADA', () => postar(s.url, '/api/nada', {}), 404, 'ROTA_NAO_ENCONTRADA'],
  ];
  for (const [nome, chamar, http, codigo] of casos) {
    it(nome, async () => {
      const r = await chamar();
      assert.equal(r.http, http);
      assert.equal(r.corpo.status, 'erro');
      assert.equal(r.corpo.erro.codigo, codigo);
      assert.ok(r.corpo.erro.mensagem_usuario.length > 10);
    });
  }

  it('exame que não está no laudo → EXAME_NAO_ENCONTRADO', async () => {
    const { corpo: tela } = await enviar(s.url, lerLaudo('glicose_normal.pdf'));
    const r = await postar(s.url, '/api/explicacoes', { id_laudo: tela.id_laudo, id_canonico: 'tsh' });
    assert.deepEqual([r.http, r.corpo.erro.codigo], [404, 'EXAME_NAO_ENCONTRADO']);
  });
  it('chat sem mensagem → REQUISICAO_INVALIDA', async () => {
    const { corpo: tela } = await enviar(s.url, lerLaudo('glicose_normal.pdf'));
    const r = await postar(s.url, '/api/chat', { id_laudo: tela.id_laudo, id_canonico: 'glicose', mensagem: '' });
    assert.equal(r.corpo.erro.codigo, 'REQUISICAO_INVALIDA');
  });
});

describe('modelo indisponível (erro SIMULADO)', () => {
  it('cliente lança erro → MODELO_INDISPONIVEL (503)', async () => {
    const s = await subir({ falhar: true });
    try {
      const { corpo: tela } = await enviar(s.url, lerLaudo('glicose_normal.pdf'));
      const r = await postar(s.url, '/api/explicacoes', { id_laudo: tela.id_laudo, id_canonico: 'glicose' });
      assert.deepEqual([r.http, r.corpo.erro.codigo, r.corpo.erro.motivo], [503, 'MODELO_INDISPONIVEL', 'erro_do_cliente']);
    } finally { await s.fechar(); }
  });
  it('cliente lento (passa de OLLAMA_TIMEOUT_MS) → MODELO_INDISPONIVEL (tempo_esgotado)', async () => {
    const s = await subir({ atrasoMs: 300 }, { timeoutMs: 50 });
    try {
      const { corpo: tela } = await enviar(s.url, lerLaudo('glicose_normal.pdf'));
      const r = await postar(s.url, '/api/explicacoes', { id_laudo: tela.id_laudo, id_canonico: 'glicose' });
      assert.deepEqual([r.http, r.corpo.erro.motivo], [503, 'tempo_esgotado']);
    } finally { await s.fechar(); }
  });
});
