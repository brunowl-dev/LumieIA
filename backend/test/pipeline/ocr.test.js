// OCR DE VERDADE (BWL-10): Tesseract.js nas imagens sintéticas de samples/laudos/,
// conferido com o gabarito. Diferente dos outros testes, este é lento (~2 s por
// imagem) e, fora do Docker, baixa os arquivos de idioma na 1ª execução (precisa
// de internet uma vez; depois ficam em cache na pasta temporária do sistema).
// Rodar: npm test. Só laudos sintéticos.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { processarLaudoImagem, processarLaudoPdf } from '../../src/pipeline/processarLaudo.js';
import { CODIGOS_ERRO_OCR, encerrarOcr, extrairTextoImagem } from '../../src/pipeline/extrairTextoImagem.js';

const PASTA_LAUDOS = join(import.meta.dirname, '..', '..', '..', 'samples', 'laudos');
const lerLaudo = (arquivo) => readFileSync(join(PASTA_LAUDOS, arquivo));
const gabarito = JSON.parse(readFileSync(join(PASTA_LAUDOS, 'gabarito.json'), 'utf8'));

// Sem isto o processo do teste não termina: o worker do Tesseract fica vivo.
after(() => encerrarOcr());

describe('OCR real: cada foto do gabarito', () => {
  for (const foto of gabarito.laudos.filter((l) => l.tipo === 'foto')) {
    if (foto.esperado_baixa_confianca) {
      it(`${foto.arquivo}: foto ruim → BAIXA_CONFIANCA, nenhum valor sai`, async () => {
        const r = await processarLaudoImagem(lerLaudo(foto.arquivo));
        assert.deepEqual([r.status, r.erro.codigo, r.erro.motivo], ['erro', 'BAIXA_CONFIANCA', 'ocr_baixa_confianca']);
        assert.equal(r.laudo, undefined);
      });
      continue;
    }
    it(`${foto.arquivo}: nome, valor, unidade, faixa e classificação = gabarito`, async () => {
      const r = await processarLaudoImagem(lerLaudo(foto.arquivo));
      assert.equal(r.status, 'ok', JSON.stringify(r.erro));
      assert.equal(r.laudo.origem, 'ocr');
      assert.deepEqual(r.laudo.itens_nao_lidos, []);
      assert.deepEqual(
        r.laudo.analitos.map((a) => [a.nome_no_laudo, a.valor, a.unidade, a.faixa_referencia.texto_original, a.classificacao, a.alerta_critico]),
        foto.analitos.map((a) => [a.nome, a.valor, a.unidade, a.faixa_impressa, a.classificacao_esperada, a.critico]),
      );
    });
  }
});

describe('OCR real: PDF digitalizado (só imagem)', () => {
  it('digitalizado_sem_texto.pdf: páginas desenhadas → OCR → glicose 118 acima', async () => {
    const r = await processarLaudoPdf(lerLaudo('digitalizado_sem_texto.pdf'));
    assert.equal(r.status, 'ok', JSON.stringify(r.erro));
    assert.equal(r.laudo.origem, 'ocr');
    assert.deepEqual(
      r.laudo.analitos.map((a) => [a.id_canonico, a.valor, a.unidade, a.classificacao]),
      [['glicose', 118, 'mg/dL', 'acima']],
    );
  });
});

describe('OCR real: identificadores e erros', () => {
  it('os identificadores do cabeçalho da foto saem SEPARADOS do laudo (para a pseudonimização)', async () => {
    const r = await processarLaudoImagem(lerLaudo('foto_glicose_acima.jpg'));
    assert.equal(r.identificadores.paciente, 'Maria Teste da Silva');
    assert.equal(r.identificadores.cpf, '000.000.000-00');
    assert.ok(!JSON.stringify(r.laudo).includes('Maria'));
  });
  it('imagem corrompida → ErroOcr IMAGEM_INVALIDA, e o OCR continua funcionando depois', async () => {
    const corrompida = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 7)]);
    await assert.rejects(extrairTextoImagem(corrompida), { name: 'ErroOcr', codigo: CODIGOS_ERRO_OCR.IMAGEM_INVALIDA });
    const depois = await extrairTextoImagem(lerLaudo('foto_glicose_acima.jpg'));
    assert.ok(depois.confianca > 70);
  });
});
