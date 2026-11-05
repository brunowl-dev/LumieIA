// Teste de ponta a ponta do momento 1 (sem IA):
// PDF ou foto → texto (BWL-02 / BWL-10) → analitos (BWL-03) → id_canonico (BWL-04)
// → confiança (BWL-06) → classificação e alerta (BWL-05).
// Rodar: npm test. Só laudos sintéticos de samples/laudos/.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { processarLaudoImagem, processarLaudoPdf, processarTextoLaudo } from '../../src/pipeline/processarLaudo.js';
import { AVISO_ITENS_NAO_LIDOS } from '../../src/pipeline/confianca.js';

const PASTA_LAUDOS = join(import.meta.dirname, '..', '..', '..', 'samples', 'laudos');
const lerLaudo = (arquivo) => readFileSync(join(PASTA_LAUDOS, arquivo));
const lerTexto = (arquivoPdf) => readFileSync(join(PASTA_LAUDOS, 'texto_extraido', arquivoPdf.replace(/\.pdf$/, '.txt')), 'utf8');
const gabarito = JSON.parse(readFileSync(join(PASTA_LAUDOS, 'gabarito.json'), 'utf8'));

const ID_ESPERADO = {
  'Glicose em jejum': 'glicose',
  'Hemoglobina': 'hemoglobina',
  'TSH': 'tsh',
  'Colesterol total': 'colesterol_total',
  'Creatinina': 'creatinina',
};

// Dados do paciente FICTÍCIO impressos nos laudos sintéticos. Nenhum pode sair do pipeline.
const IDENTIFICADORES = ['Maria', 'Teste da Silva', '000.000.000-00', '14/03/1992', 'TESTE-0', 'Rua Exemplo', 'João Exemplo', 'Feminino', '34 anos'];

describe('ponta a ponta: cada PDF digital do gabarito', () => {
  for (const laudo of gabarito.laudos.filter((l) => l.tipo === 'pdf_digital')) {
    it(`${laudo.arquivo}: classificação e alerta crítico = gabarito`, async () => {
      const r = await processarLaudoPdf(lerLaudo(laudo.arquivo), { idLaudo: 'teste' });
      assert.equal(r.status, 'ok');
      assert.equal(r.laudo.origem, 'pdf_digital');
      assert.equal(r.laudo.confianca_extracao, 1);
      assert.deepEqual(r.laudo.itens_nao_lidos, []);
      assert.equal(r.laudo.aviso_usuario, null);
      assert.deepEqual(
        r.laudo.analitos.map((a) => [a.id_canonico, a.valor, a.unidade, a.classificacao, a.alerta_critico]),
        laudo.analitos.map((a) => [ID_ESPERADO[a.nome], a.valor, a.unidade, a.classificacao_esperada, a.critico]),
      );
    });
  }
});

describe('ponta a ponta: casos de borda', () => {
  it('glicose_limite.pdf: 99 em "70 a 99" → dentro', async () => {
    const { laudo } = await processarLaudoPdf(lerLaudo('glicose_limite.pdf'));
    assert.equal(laudo.analitos[0].classificacao, 'dentro');
  });
  it('colesterol_total_limite.pdf: 190 em "Inferior a 190" → acima, sem alerta (não há limite crítico)', async () => {
    const [a] = (await processarLaudoPdf(lerLaudo('colesterol_total_limite.pdf'))).laudo.analitos;
    assert.deepEqual([a.classificacao, a.alerta_critico, a.limite_critico.motivo], ['acima', false, 'sem_limite_definido']);
  });
  it('glicose_critico_alto.pdf: alerta com a fonte do limite na saída', async () => {
    const [a] = (await processarLaudoPdf(lerLaudo('glicose_critico_alto.pdf'))).laudo.analitos;
    assert.equal(a.alerta_critico, true);
    assert.equal(a.limite_critico.acionado, 'acima_de');
    assert.equal(a.limite_critico.acima_de, 450);
    assert.equal(a.limite_critico.fonte.id, 'pncq_2019');
  });
  it('glicose_unidade_mmol.pdf: classifica pela faixa do laudo, mas não avalia o limite (unidade diferente)', async () => {
    const [a] = (await processarLaudoPdf(lerLaudo('glicose_unidade_mmol.pdf'))).laudo.analitos;
    assert.equal(a.classificacao, 'acima');
    assert.equal(a.alerta_critico, false);
    assert.equal(a.limite_critico.avaliado, false);
    assert.equal(a.limite_critico.motivo, 'unidade_diferente');
    assert.deepEqual(a.avisos, ['unidade_diferente_da_esperada']);
  });
});

describe('ponta a ponta: confiança e "envie novamente"', () => {
  it('painel_parcial_ilegivel.pdf (caso misto): segue com os confiáveis, sinaliza a creatinina sem valor', async () => {
    const { status, laudo } = await processarLaudoPdf(lerLaudo('painel_parcial_ilegivel.pdf'));
    assert.equal(status, 'ok');
    assert.equal(laudo.confianca_extracao, 0.96); // (5 × 1 + 0,75) / 6
    // Ordem do laudo; Ureia não tem ficha (id null), mas é classificada pela faixa do laudo.
    assert.deepEqual(laudo.analitos.map((a) => [a.id_canonico, a.classificacao]), [
      ['glicose', 'acima'], ['hemoglobina', 'dentro'], ['tsh', 'acima'], ['colesterol_total', 'dentro'], [null, 'dentro'],
    ]);
    assert.equal(laudo.analitos[4].nome_no_laudo, 'Ureia');
    assert.equal(laudo.analitos[4].limite_critico.motivo, 'exame_nao_reconhecido');
    assert.deepEqual(laudo.itens_nao_lidos, [
      { id_canonico: 'creatinina', nome_no_laudo: 'Creatinina', motivos: ['faixa_nao_interpretada'] },
    ]);
    assert.equal(laudo.aviso_usuario, AVISO_ITENS_NAO_LIDOS);
  });
  it('painel_maioria_ilegivel.pdf: média 0,63 < 0,80 → BAIXA_CONFIANCA', async () => {
    const r = await processarLaudoPdf(lerLaudo('painel_maioria_ilegivel.pdf'));
    assert.equal(r.status, 'erro');
    assert.equal(r.erro.codigo, 'BAIXA_CONFIANCA');
    assert.equal(r.erro.motivo, 'confianca_abaixo_do_minimo');
    assert.ok(r.erro.mensagem_usuario.length > 0);
    assert.equal(r.laudo, undefined); // nenhum valor sai quando o laudo é recusado
  });
  it('digitalizado_sem_texto.pdf (só imagem) → cada página desenhada vai para o OCR (aqui simulado)', async () => {
    const recebidas = [];
    const ocr = async (imagem) => { recebidas.push(imagem); return { texto: lerTexto('glicose_acima.pdf'), confianca: 90 }; };
    const r = await processarLaudoPdf(lerLaudo('digitalizado_sem_texto.pdf'), { ocr });
    assert.equal(recebidas.length, 1); // 1 página
    assert.ok(recebidas[0].subarray(1, 4).equals(Buffer.from('PNG'))); // a página chega ao OCR como PNG
    assert.equal(r.laudo.origem, 'ocr');
    assert.deepEqual(r.laudo.analitos.map((a) => [a.id_canonico, a.classificacao]), [['glicose', 'acima']]);
  });
  it('PDF digital com texto NÃO passa pelo OCR', async () => {
    const ocr = async () => assert.fail('o OCR não deveria ser chamado');
    assert.equal((await processarLaudoPdf(lerLaudo('glicose_acima.pdf'), { ocr })).laudo.origem, 'pdf_digital');
  });
  it('foto_borrada.jpg não é PDF: o erro da BWL-02 sobe para o orquestrador traduzir', async () => {
    await assert.rejects(processarLaudoPdf(lerLaudo('foto_borrada.jpg')), { name: 'ErroExtracaoPdf', codigo: 'ARQUIVO_NAO_E_PDF' });
  });
  it('laudo_protegido.pdf: sem senha → PDF_PROTEGIDO; com a senha sintética → glicose dentro', async () => {
    await assert.rejects(processarLaudoPdf(lerLaudo('laudo_protegido.pdf')), { codigo: 'PDF_PROTEGIDO' });
    const r = await processarLaudoPdf(lerLaudo('laudo_protegido.pdf'), { senha: 'lumie-teste-123' });
    assert.deepEqual(r.laudo.analitos.map((a) => [a.id_canonico, a.classificacao]), [['glicose', 'dentro']]);
  });
});

describe('ponta a ponta: OCR simulado (a confiança viria do Tesseract, BWL-10)', () => {
  // O texto é o da foto de origem (glicose_acima.pdf); só a confiança do OCR muda.
  const texto = lerTexto('glicose_acima.pdf');
  it('foto borrada (Tesseract 35) → BAIXA_CONFIANCA com mensagem de foto', () => {
    const r = processarTextoLaudo(texto, { origem: 'ocr', confiancaOcr: 35 });
    assert.deepEqual([r.status, r.erro.codigo, r.erro.motivo], ['erro', 'BAIXA_CONFIANCA', 'ocr_baixa_confianca']);
    assert.match(r.erro.mensagem_usuario, /foto/);
  });
  it('foto nítida (Tesseract 91) → segue, confiança 0,91', () => {
    const r = processarTextoLaudo(texto, { origem: 'ocr', confiancaOcr: 91 });
    assert.equal(r.status, 'ok');
    assert.equal(r.laudo.origem, 'ocr');
    assert.equal(r.laudo.confianca_extracao, 0.91);
    assert.equal(r.laudo.analitos[0].classificacao, 'acima');
  });
  it('foto com OCR 75 (passa no 70 da página, mas cada item fica 0,75 < 0,80) → BAIXA_CONFIANCA', () => {
    const r = processarTextoLaudo(texto, { origem: 'ocr', confiancaOcr: 75 });
    assert.equal(r.erro.motivo, 'confianca_abaixo_do_minimo');
  });
});

describe('processarLaudoImagem (OCR simulado; o real está em ocr.test.js)', () => {
  it('aplica as correções do OCR antes de estruturar (µ lido como H, faixa sem espaço)', async () => {
    const texto = ['Exame Resultado Unidade Valores de referência', 'TSH 7,80 HUI/mL 0,45 a 4,50', 'Hemoglobina 13,8 g/dL 12,0a 16,0'].join('\n');
    const r = await processarLaudoImagem(Buffer.from('foto'), { ocr: async () => ({ texto, confianca: 90 }) });
    assert.deepEqual(
      r.laudo.analitos.map((a) => [a.id_canonico, a.unidade, a.faixa_referencia.texto_original, a.avisos]),
      [['tsh', 'µUI/mL', '0,45 a 4,50', []], ['hemoglobina', 'g/dL', '12,0 a 16,0', []]],
    );
  });
  it('confiança da página abaixo de CONFIANCA_MINIMA_OCR → BAIXA_CONFIANCA, nenhum valor sai', async () => {
    const r = await processarLaudoImagem(Buffer.from('foto'), { ocr: async () => ({ texto: lerTexto('glicose_acima.pdf'), confianca: 40 }) });
    assert.deepEqual([r.erro.codigo, r.erro.motivo], ['BAIXA_CONFIANCA', 'ocr_baixa_confianca']);
    assert.equal(r.laudo, undefined);
  });
});

describe('ponta a ponta: regras do laudo estruturado', () => {
  const linhas = (...resultados) => ['Exame Resultado Unidade Valores de referência', ...resultados].join('\n');
  it('mesmo exame duas vezes com o mesmo valor → aparece uma vez', () => {
    const r = processarTextoLaudo(linhas('Glicose em jejum 88 mg/dL 70 a 99', 'Glicemia 88 mg/dL 70 a 99'));
    assert.deepEqual(r.laudo.analitos.map((a) => a.id_canonico), ['glicose']);
  });
  it('mesmo exame duas vezes com valores diferentes → não escolhe: os dois saem como não lidos', () => {
    const r = processarTextoLaudo(linhas('Glicose em jejum 88 mg/dL 70 a 99', 'Glicemia 486 mg/dL 70 a 99', 'Hemoglobina 13,8 g/dL 12,0 a 16,0'));
    assert.deepEqual(r.laudo.analitos.map((a) => a.id_canonico), ['hemoglobina']);
    assert.deepEqual(r.laudo.itens_nao_lidos.map((i) => i.motivos), [['exame_repetido_com_valores_diferentes'], ['exame_repetido_com_valores_diferentes']]);
  });
  it('texto vazio → BAIXA_CONFIANCA (nenhum resultado encontrado)', () => {
    assert.equal(processarTextoLaudo('').erro.motivo, 'nenhum_resultado_encontrado');
  });
  it('id_laudo gerado pelo sistema (UUID), sem relação com o paciente', () => {
    assert.match(processarTextoLaudo(lerTexto('glicose_normal.pdf')).laudo.id_laudo, /^[0-9a-f-]{36}$/);
  });
  it('nenhum identificador do paciente (fictício) aparece no LAUDO estruturado', async () => {
    for (const arquivo of ['painel_misto_layoutA.pdf', 'painel_misto_layoutB.pdf', 'painel_parcial_ilegivel.pdf']) {
      const saida = JSON.stringify((await processarLaudoPdf(lerLaudo(arquivo))).laudo);
      for (const identificador of IDENTIFICADORES) {
        assert.ok(!saida.includes(identificador), `"${identificador}" apareceu na saída de ${arquivo}`);
      }
    }
  });
  it('identificadores saem SEPARADOS do laudo (contrato §2.6), só para a sessão', async () => {
    const r = await processarLaudoPdf(lerLaudo('glicose_acima.pdf'));
    assert.deepEqual(Object.keys(r).sort(), ['identificadores', 'laudo', 'status']);
    assert.equal(r.identificadores.paciente, 'Maria Teste da Silva');
    assert.equal(r.identificadores.cpf, '000.000.000-00');
  });
  it('erro de confiança não devolve identificadores', () => {
    assert.equal(processarTextoLaudo('').identificadores, undefined);
  });
  it('só os campos do contrato saem em cada analito (nada de valor_impresso, pendencias, linhas do laudo)', async () => {
    const { laudo } = await processarLaudoPdf(lerLaudo('glicose_acima.pdf'));
    assert.deepEqual(Object.keys(laudo).sort(), ['analitos', 'aviso_usuario', 'confianca_extracao', 'id_laudo', 'itens_nao_lidos', 'linhas_nao_interpretadas', 'origem']);
    assert.deepEqual(Object.keys(laudo.analitos[0]).sort(), [
      'alerta_critico', 'avisos', 'classificacao', 'confianca', 'faixa_referencia', 'id_canonico', 'limite_critico', 'nome_no_laudo', 'unidade', 'valor',
    ]);
    assert.deepEqual(Object.keys(laudo.analitos[0].faixa_referencia).sort(), ['maximo', 'maximo_inclusivo', 'minimo', 'minimo_inclusivo', 'texto_original']);
  });
});
