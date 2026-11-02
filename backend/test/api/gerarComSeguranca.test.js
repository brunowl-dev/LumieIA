// Laço de regeneração (BWL-08). Rodar: npm test.
// O gerador é uma IA falsa com respostas roteirizadas (samples/respostas-ia/).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gerarComSeguranca } from '../../src/api/gerarComSeguranca.js';
import { verificarExplicacao } from '../../src/seguranca/verificarResposta.js';
import { montarExplicacaoPadrao } from '../../src/seguranca/mensagemPadrao.js';

const SAMPLES = join(import.meta.dirname, '..', '..', '..', 'samples');
const lerJson = (...p) => JSON.parse(readFileSync(join(SAMPLES, ...p), 'utf8'));
const FICHA = JSON.parse(readFileSync(join(SAMPLES, '..', 'docs', 'base-conhecimento', 'exames.json'), 'utf8'))
  .exames.find((f) => f.id_canonico === 'glicose');
const [ANALITO] = lerJson('glicose-alterada.json').analitos;
const BOA = lerJson('respostas-ia', 'aprovada.json');
const SEM_AVISO = lerJson('respostas-ia', 'reprovada-sem-aviso.json');
const DIAGNOSTICO = lerJson('respostas-ia', 'reprovada-diagnostico.json');

// IA falsa: devolve as respostas do roteiro, na ordem, e anota os motivos que recebeu.
function iaRoteirizada(...roteiro) {
  const motivosRecebidos = [];
  return {
    motivosRecebidos,
    gerar: async (motivos) => { motivosRecebidos.push(motivos); return roteiro[Math.min(motivosRecebidos.length - 1, roteiro.length - 1)]; },
  };
}
const executar = (ia, maxRegeneracoes = 2) => gerarComSeguranca({
  gerar: ia.gerar,
  verificar: (r) => verificarExplicacao(r, ANALITO, FICHA),
  mensagemPadrao: () => montarExplicacaoPadrao(ANALITO, FICHA),
  maxRegeneracoes,
});

describe('gerarComSeguranca', () => {
  it('aprova de primeira → resposta do modelo, 0 regenerações', async () => {
    const ia = iaRoteirizada(BOA);
    const r = await executar(ia);
    assert.deepEqual([r.origem_texto, r.tentativas_regeneracao, ia.motivosRecebidos.length], ['modelo', 0, 1]);
    assert.equal(r.conteudo, BOA);
  });

  it('reprova e a regeneração aprova → 1 regeneração; a 2ª chamada recebe o motivo', async () => {
    const ia = iaRoteirizada(SEM_AVISO, BOA);
    const r = await executar(ia);
    assert.deepEqual([r.origem_texto, r.tentativas_regeneracao], ['modelo', 1]);
    assert.deepEqual(ia.motivosRecebidos, [[], ['parte_ausente', 'aviso_ausente']]);
  });

  it('reprova sempre → 3 tentativas (MAX_REGENERACOES = 2) e mensagem padrão', async () => {
    const ia = iaRoteirizada(DIAGNOSTICO);
    const r = await executar(ia);
    assert.equal(ia.motivosRecebidos.length, 3);
    assert.deepEqual([r.origem_texto, r.tentativas_regeneracao], ['mensagem_padrao', 2]);
    assert.deepEqual(r.conteudo, montarExplicacaoPadrao(ANALITO, FICHA));
  });

  it('MAX_REGENERACOES = 0 → uma tentativa só', async () => {
    const ia = iaRoteirizada(DIAGNOSTICO);
    assert.equal((await executar(ia, 0)).origem_texto, 'mensagem_padrao');
    assert.equal(ia.motivosRecebidos.length, 1);
  });

  it('erro do modelo NÃO vira mensagem padrão: sobe para a rota (MODELO_INDISPONIVEL)', async () => {
    const gerar = async () => { throw Object.assign(new Error('timeout'), { codigo: 'MODELO_INDISPONIVEL' }); };
    await assert.rejects(executar({ gerar }), { codigo: 'MODELO_INDISPONIVEL' });
  });

  it('mensagem padrão reprovada (bug no texto fixo) → falha alto, não entrega', async () => {
    await assert.rejects(gerarComSeguranca({
      gerar: async () => DIAGNOSTICO,
      verificar: (r) => verificarExplicacao(r, ANALITO, FICHA),
      mensagemPadrao: () => ({ ...montarExplicacaoPadrao(ANALITO, FICHA), aviso: '' }),
      maxRegeneracoes: 1,
    }), /Mensagem padrão reprovada/);
  });
});
