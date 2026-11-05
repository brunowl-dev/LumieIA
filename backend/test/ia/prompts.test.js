// Testes dos prompts versionados (ISA-02). Sem rede e sem modelo: conferem o TEXTO
// do prompt. O principal: os exemplos de "saída boa" que o prompt mostra ao modelo
// precisam passar na camada de segurança; um exemplo reprovado ensinaria o erro.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSAO_PROMPT, carregarPrompt } from '../../src/ia/prompts.js';
import { verificarChat, verificarExplicacao } from '../../src/seguranca/verificarResposta.js';

const SAMPLES = join(import.meta.dirname, '..', '..', '..', 'samples');
const ler = (caminho) => JSON.parse(readFileSync(join(SAMPLES, caminho), 'utf8'));
const AVISO = 'Esta explicação é informativa e não substitui a avaliação de um profissional de saúde.';

// Os exemplos ficam no prompt como linhas que começam com {"
const exemplosDo = (prompt) => prompt.split('\n').filter((linha) => linha.startsWith('{"')).map((linha) => JSON.parse(linha));

describe('prompts (ISA-02)', () => {
  it('a versão em uso é a v2 e os dois prompts carregam', () => {
    assert.equal(VERSAO_PROMPT, 'v2');
    for (const nome of ['explicacao', 'chat']) assert.ok(carregarPrompt(nome).length > 200, nome);
  });

  it('nome desconhecido → erro (não monta caminho com texto arbitrário)', () => {
    assert.throws(() => carregarPrompt('../../../.env'), /desconhecido/);
  });

  it('os dois prompts têm as regras obrigatórias do contrato §4.5', () => {
    for (const nome of ['explicacao', 'chat']) {
      const prompt = carregarPrompt(nome);
      assert.ok(prompt.includes(AVISO), `${nome}: aviso exato`);
      assert.ok(prompt.includes('a `ficha` prevalece'), `${nome}: ficha prevalece`);
      assert.ok(prompt.includes('merece atenção'), `${nome}: "merece atenção"`);
      assert.ok(prompt.includes('[PACIENTE_1]'), `${nome}: não repetir marcadores`);
      assert.ok(prompt.includes('alerta_critico'), `${nome}: alerta crítico`);
    }
  });

  it('explicação: as 5 partes aparecem na ordem do contrato §4.3', () => {
    const prompt = carregarPrompt('explicacao');
    const posicoes = ['o_que_avalia', 'valor_e_posicao', 'significado', 'especialidade', 'aviso']
      .map((campo) => prompt.indexOf(`. \`${campo}\`:`));
    assert.ok(posicoes.every((p) => p >= 0), 'cada campo numerado');
    assert.deepEqual([...posicoes].sort((a, b) => a - b), posicoes);
  });

  it('os exemplos da explicação passam na segurança (dentro e acima da faixa)', () => {
    const entradas = [ler('entradas-ia/explicacao-glicose-normal.json'), ler('entradas-ia/explicacao-glicose-acima.json')];
    const exemplos = exemplosDo(carregarPrompt('explicacao'));
    assert.equal(exemplos.length, 2);
    exemplos.forEach((exemplo, i) => {
      assert.deepEqual(verificarExplicacao(exemplo, entradas[i].analito, entradas[i].ficha), { aprovada: true, motivos: [] });
    });
  });

  it('v2: o prompt usa ficha.significado_resultado no significado', () => {
    for (const nome of ['explicacao', 'chat']) assert.ok(carregarPrompt(nome).includes('significado_resultado'), nome);
  });

  it('os exemplos do chat passam na segurança', () => {
    const { ficha } = ler('entradas-ia/chat-glicose.json');
    const exemplos = exemplosDo(carregarPrompt('chat'));
    assert.equal(exemplos.length, 2);
    for (const exemplo of exemplos) assert.deepEqual(verificarChat(exemplo, ficha), { aprovada: true, motivos: [] });
  });
});
