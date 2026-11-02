// Testes da BWL-02 (extração de texto do PDF digital). Rodar: npm test
// Não usam rede: só os arquivos de samples/laudos/.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import {
  extrairTextoPdf,
  LIMIAR_CARACTERES_UTEIS,
} from '../../src/pipeline/extrairTextoPdf.js';

const PASTA_LAUDOS = join(import.meta.dirname, '..', '..', '..', 'samples', 'laudos');
const lerLaudo = (arquivo) => readFileSync(join(PASTA_LAUDOS, arquivo));
const gabarito = JSON.parse(readFileSync(join(PASTA_LAUDOS, 'gabarito.json'), 'utf8'));
const pdfsDigitais = gabarito.laudos.filter((laudo) => laudo.tipo === 'pdf_digital');

// Senha sintética do laudo_protegido.pdf (documentada no README de samples/laudos).
const SENHA_LAUDO_PROTEGIDO = 'lumie-teste-123';

// Tolera só diferenças de espaços e quebras de linha: toda sequência de
// espaço/tab/quebra vira um espaço. Nada mais é alterado (vírgula, µ etc.).
const juntarEspacos = (texto) => texto.replace(/\s+/g, ' ');

const erroComCodigo = (codigo) => ({ name: 'ErroExtracaoPdf', codigo });

describe('extrairTextoPdf: PDFs digitais do gabarito', () => {
  for (const laudo of pdfsDigitais) {
    it(`${laudo.arquivo} contém valor, unidade e faixa de cada analito`, async () => {
      const resultado = await extrairTextoPdf(lerLaudo(laudo.arquivo));
      const texto = juntarEspacos(resultado.texto);

      assert.equal(resultado.numPaginas, 1);
      assert.equal(resultado.temCamadaDeTexto, true);
      for (const analito of laudo.analitos) {
        // Valor e unidade juntos ("13,8 g/dL"): nos dois layouts a unidade vem
        // logo depois do valor, e isso evita casar o "88" com outro número qualquer.
        assert.ok(
          texto.includes(juntarEspacos(`${analito.valor_impresso} ${analito.unidade}`)),
          `"${analito.valor_impresso} ${analito.unidade}" (${analito.nome}) não encontrado`,
        );
        assert.ok(
          texto.includes(juntarEspacos(analito.faixa_impressa)),
          `faixa "${analito.faixa_impressa}" (${analito.nome}) não encontrada`,
        );
      }
    });
  }

  it('preserva o µ (U+00B5) da unidade do TSH, sem trocar pela letra grega μ', async () => {
    const { texto } = await extrairTextoPdf(lerLaudo('tsh_normal.pdf'));
    assert.ok(texto.includes('µUI/mL'));
    assert.ok(!texto.includes('μ'));
  });

  it('não inclui o marcador de página que o pdf-parse inventa ("-- 1 of 1 --")', async () => {
    const { texto } = await extrairTextoPdf(lerLaudo('glicose_normal.pdf'));
    assert.ok(!texto.includes('-- 1 of 1 --'));
  });

  it('usa só \\n como quebra de linha e conta caracteres não-espaço', async () => {
    const resultado = await extrairTextoPdf(lerLaudo('glicose_normal.pdf'));
    assert.ok(!resultado.texto.includes('\r'));
    assert.equal(resultado.caracteresUteis, resultado.texto.replace(/\s/g, '').length);
  });

  it('não escreve nada no console (o texto é dado de saúde)', async (t) => {
    const metodos = ['log', 'info', 'warn', 'error', 'debug'];
    const espioes = metodos.map((m) => t.mock.method(console, m, () => {}));
    await extrairTextoPdf(lerLaudo('painel_misto_layoutA.pdf'));
    for (const espiao of espioes) assert.equal(espiao.mock.callCount(), 0);
  });
});

describe('extrairTextoPdf: PDF sem camada de texto', () => {
  it('digitalizado_sem_texto.pdf (só imagem) → temCamadaDeTexto false', async () => {
    const resultado = await extrairTextoPdf(lerLaudo('digitalizado_sem_texto.pdf'));
    assert.equal(resultado.numPaginas, 1);
    assert.equal(resultado.caracteresUteis, 0);
    assert.ok(resultado.caracteresUteis < LIMIAR_CARACTERES_UTEIS);
    assert.equal(resultado.temCamadaDeTexto, false);
  });
});

describe('extrairTextoPdf: PDF protegido por senha', () => {
  it('sem senha → PDF_PROTEGIDO', async () => {
    await assert.rejects(extrairTextoPdf(lerLaudo('laudo_protegido.pdf')), erroComCodigo('PDF_PROTEGIDO'));
  });

  it('senha errada → SENHA_INCORRETA', async () => {
    await assert.rejects(
      extrairTextoPdf(lerLaudo('laudo_protegido.pdf'), { senha: 'senha-errada' }),
      erroComCodigo('SENHA_INCORRETA'),
    );
  });

  it('senha certa → lê o texto normalmente', async () => {
    const resultado = await extrairTextoPdf(lerLaudo('laudo_protegido.pdf'), { senha: SENHA_LAUDO_PROTEGIDO });
    assert.equal(resultado.temCamadaDeTexto, true);
    assert.ok(juntarEspacos(resultado.texto).includes('88 mg/dL'));
  });
});

describe('extrairTextoPdf: erros', () => {
  it('buffer vazio → ARQUIVO_VAZIO', async () => {
    await assert.rejects(extrairTextoPdf(Buffer.alloc(0)), erroComCodigo('ARQUIVO_VAZIO'));
  });

  it('JPG → ARQUIVO_NAO_E_PDF', async () => {
    await assert.rejects(extrairTextoPdf(lerLaudo('foto_glicose_acima.jpg')), erroComCodigo('ARQUIVO_NAO_E_PDF'));
  });

  it('bytes aleatórios → ARQUIVO_NAO_E_PDF', async () => {
    await assert.rejects(extrairTextoPdf(randomBytes(4096)), erroComCodigo('ARQUIVO_NAO_E_PDF'));
  });

  it('PDF truncado pela metade → PDF_CORROMPIDO', async () => {
    const pdf = lerLaudo('glicose_normal.pdf');
    const truncado = pdf.subarray(0, Math.floor(pdf.length / 2));
    await assert.rejects(extrairTextoPdf(truncado), erroComCodigo('PDF_CORROMPIDO'));
  });

  it('cabeçalho %PDF- seguido de lixo → PDF_CORROMPIDO', async () => {
    await assert.rejects(extrairTextoPdf(Buffer.from('%PDF-1.4 isto não é um PDF')), erroComCodigo('PDF_CORROMPIDO'));
  });

  it('argumento que não é Buffer → TypeError (erro de programação)', async () => {
    await assert.rejects(extrairTextoPdf('glicose_normal.pdf'), TypeError);
  });
});
