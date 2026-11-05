// Layout C: laudo de vários exames em várias páginas, no FORMATO de um laudo real
// de laboratório testado em 04/11/2026 (o arquivo real NÃO está no repositório).
// Tudo aqui é FICTÍCIO: paciente, médico, laboratório, códigos e valores.
// Cobre o que esse formato revelou: valor antes do nome (hemograma), faixas por
// categoria na linha do "Resultado:", cabeçalho "Valor de Referência" acima do
// resultado, nome "SIGLA - NOME", registro profissional no rodapé.
// Rodar: npm test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estruturarAnalitos } from '../../src/pipeline/estruturarAnalitos.js';
import { extrairIdentificadores } from '../../src/pipeline/extrairIdentificadores.js';
import { processarTextoLaudo } from '../../src/pipeline/processarLaudo.js';
import { montarEntradaIa } from '../../src/seguranca/pseudonimizar.js';

const CABECALHO = [
  'LABORATÓRIO MODELO C (FICTÍCIO)',
  'Paciente: 000123 - MARIA TESTE LU Ficha: -',
  '1/20/2026\tData Nasc.: 3/14/1992, 34a Cadastro:',
  'Convênio PLANO FICTÍCIO Emissão: 04/11/2026',
  'Pedido: 99990001\tSolicitante: CRM-SP-000000 JOAO EXEMPLO',
  'RG: 00000000',
];
const RODAPE = ['Liberação/Release: DRA ANA EXEMPLO -', 'CRBM 00000', 'Pág. 1 de 2'];

const TEXTO = [
  ...CABECALHO,
  'HEMOGRAMA COMPLETO',
  'ERITROGRAMA Valor de Referência',
  '5.1\tHEMÁCIAS milh/mm3 (4,3 a 5,7)',
  '14.2\tHEMOGLOBINA g/dL (13,5 a 17,5)',
  'C H C M 32.0 g/dL (31,0 a 36,0)',
  'PLAQUETAS 250.000 /mm3 150.000 a 450.000/mm3',
  '1\tBASÓFILOS 63 (0 a 105) (0 a 1)',
  ...RODAPE,
  ...CABECALHO,
  'TSH - HORMÔNIO TIREOESTIMULANTE',
  'Valor de Referência',
  'Resultado: 7,10 µUI/mL Prematuros (28 a 36 semanas): 0,70 a 27,00 µUI/mL',
  'Recém nascidos (1 a 4 dias) : 1,00 a 39,00 µUI/mL',
  '5 meses a 20 anos...........: 0,70 a 6,40 µUI/mL',
  'Adultos: 0,38 a 5,33 µUI/mL',
  'Gestantes: 1° trimestre: 0,05 a 3,70 µUI/mL',
  'Método: QUIMIOLUMINESCÊNCIA',
  'VITAMINA D - 25 HIDROXI',
  'Valores de Referência',
  'Resultado: 25,0 ng/mL Deficiência............................: Inferior a 20,0 ng/mL',
  'Valores normais para a população geral: Entre 20,0 e 60,0 ng/mL',
  'Risco de intoxicação...................: Superior a 100,0 ng/mL',
  'Nota:',
  'FERRO SÉRICO Valor de Referência',
  'Resultado: 90 µg/dL Recém-nascido: 100 - 250 µg/dL',
  'Adultos:',
  'Masculino:.... 65 - 175 µg/dL',
  'VITAMINA B12',
  'Valor de Referência',
  'Resultado: 400 pg/mL Feminino.: 114 a 890 pg/mL',
  'Masculino: 130 a 868 pg/mL',
  'Método: Quimioluminescencia',
  'VITAMINA C Valor de Referência',
  'Resultado: 2,3 mg/L 4,6 a 15,0 mg/L',
  'VDRL',
  'Resultado: Não Reagente Não reagente',
  ...RODAPE,
].join('\n');

const porNome = (analitos, nome) => analitos.find((a) => a.nome_no_laudo === nome);

describe('Layout C: estruturação', () => {
  const { analitos } = estruturarAnalitos(TEXTO);

  it('hemograma com o valor ANTES do nome: "14.2 HEMOGLOBINA g/dL (13,5 a 17,5)"', () => {
    const hb = porNome(analitos, 'HEMOGLOBINA');
    assert.deepEqual([hb.valor, hb.unidade, hb.faixa_referencia.minimo, hb.faixa_referencia.maximo], [14.2, 'g/dL', 13.5, 17.5]);
  });
  it('faixa entre parênteses e unidade colada no número são interpretadas', () => {
    assert.equal(porNome(analitos, 'C H C M').faixa_referencia.interpretada, true);
    assert.deepEqual([porNome(analitos, 'PLAQUETAS').valor, porNome(analitos, 'PLAQUETAS').faixa_referencia.maximo], [250000, 450000]);
  });
  it('linha ambígua do leucograma ("1 BASÓFILOS 63 ...") não vira analito', () => {
    assert.equal(porNome(analitos, 'BASÓFILOS'), undefined);
  });
  it('TSH: categorias na linha do Resultado → usa "Adultos", NUNCA a 1ª (prematuros)', () => {
    const tsh = porNome(analitos, 'TSH - HORMÔNIO TIREOESTIMULANTE');
    assert.equal(tsh.faixa_referencia.texto_original, 'Adultos: 0,38 a 5,33 µUI/mL');
    assert.deepEqual([tsh.faixa_referencia.minimo, tsh.faixa_referencia.maximo], [0.38, 5.33]);
    assert.equal(tsh.outras_faixas.length, 4);
  });
  it('"Valor de Referência" nunca é o nome; colado no nome, sai dele', () => {
    assert.ok(!analitos.some((a) => /refer/i.test(a.nome_no_laudo)));
    assert.ok(porNome(analitos, 'VITAMINA C'));
  });
  it('vitamina D: "Deficiência: Inferior a 20,0" NÃO é a faixa; usa "Valores normais: Entre 20,0 e 60,0"', () => {
    const vitD = porNome(analitos, 'VITAMINA D - 25 HIDROXI');
    assert.deepEqual([vitD.faixa_referencia.minimo, vitD.faixa_referencia.maximo], [20, 60]);
  });
  it('faixa só por sexo (B12) → não interpretada: o sistema não usa o sexo do paciente', () => {
    assert.equal(porNome(analitos, 'VITAMINA B12').faixa_referencia.interpretada, false);
  });
  it('uma categoria só e de outro grupo ("Recém-nascido") → não interpretada, mesmo sendo uma faixa válida', () => {
    const ferro = porNome(analitos, 'FERRO SÉRICO');
    assert.equal(ferro.faixa_referencia.interpretada, false);
    assert.equal(ferro.faixa_referencia.minimo, null);
  });
  it('registro profissional do rodapé ("CRBM 00000") não é exame nem linha não interpretada', () => {
    const { nao_interpretadas: naoInterpretadas } = estruturarAnalitos(TEXTO);
    assert.ok(!naoInterpretadas.some((l) => /CRBM/.test(l.linha)));
  });
});

describe('Layout C: laudo inteiro (PDF digital)', () => {
  const r = processarTextoLaudo(TEXTO, { origem: 'pdf_digital' });

  it('segue: linha de formato desconhecido não derruba um PDF digital (o paciente é avisado)', () => {
    assert.equal(r.status, 'ok', JSON.stringify(r.erro));
    assert.ok(r.laudo.linhas_nao_interpretadas > 0);
    assert.ok(r.laudo.aviso_usuario);
  });
  it('reconhecidos pela base ("TSH - HORMÔNIO..." e "VITAMINA D - 25 HIDROXI" pelas partes) e classificados', () => {
    const resumo = r.laudo.analitos.filter((a) => a.id_canonico).map((a) => [a.id_canonico, a.classificacao]);
    assert.deepEqual(resumo, [
      ['hemacias', 'dentro'], ['hemoglobina', 'dentro'], ['plaquetas', 'dentro'],
      ['tsh', 'acima'], ['vitamina_d', 'dentro'], ['vitamina_c', 'abaixo'],
    ]);
  });
  it('VDRL "Não Reagente Não reagente" → descritivo conforme a referência', () => {
    assert.deepEqual(r.laudo.itens_descritivos, [
      { nome_no_laudo: 'VDRL', resultado: 'Não Reagente', referencia: 'Não reagente', situacao: 'conforme_referencia' },
    ]);
  });
  it('B12 e ferro aparecem como não lidos (sem valor), não com uma faixa errada', () => {
    const naoLidos = r.laudo.itens_nao_lidos.map((i) => i.nome_no_laudo);
    assert.ok(naoLidos.includes('VITAMINA B12') && naoLidos.includes('FERRO SÉRICO'));
  });
  it('na FOTO, as mesmas linhas desconhecidas contam (podem ser erro do OCR) e a confiança cai', () => {
    const foto = processarTextoLaudo(TEXTO, { origem: 'ocr', confiancaOcr: 95 });
    assert.equal(foto.erro?.codigo, 'BAIXA_CONFIANCA');
  });
});

describe('Layout C: identificadores e pseudonimização', () => {
  const id = extrairIdentificadores(TEXTO);

  it('paciente sem o código antes do nome; nascimento só a data; CRM e médico separados', () => {
    assert.equal(id.paciente, 'MARIA TESTE LU');
    assert.equal(id.nascimento, '3/14/1992');
    assert.equal(id.crm, 'SP-000000');
    assert.equal(id.medico, 'JOAO EXEMPLO');
  });
  it('nada disso chega à IA, nem o sobrenome de 2 letras', () => {
    const tsh = porNome(processarTextoLaudo(TEXTO).laudo.analitos, 'TSH - HORMÔNIO TIREOESTIMULANTE');
    const ficha = { o_que_avalia: 'x', especialidade: 'Endocrinologia' };
    for (const mensagem of ['Sou a Maria Lu, nasci em 3/14/1992', 'maria teste aqui, RG 00000000', 'O Dr. Joao Exemplo pediu, CRM-SP-000000']) {
      const saida = JSON.stringify(montarEntradaIa({ analito: tsh, ficha, mensagem, historico: [], identificadores: id }).entrada);
      for (const proibido of [/maria/i, /teste/i, /\blu\b/i, /3\/14\/1992/, /00000000/, /joao/i, /exemplo/i, /000000/]) {
        assert.ok(!proibido.test(saida), `${proibido} chegou à IA: ${saida}`);
      }
    }
  });
  it('"Lu" no meio de outra palavra não é trocado ("luz")', () => {
    const tsh = porNome(processarTextoLaudo(TEXTO).laudo.analitos, 'TSH - HORMÔNIO TIREOESTIMULANTE');
    const { entrada } = montarEntradaIa({ analito: tsh, ficha: { o_que_avalia: 'x', especialidade: 'E' }, mensagem: 'A luz atrapalha o exame?', historico: [], identificadores: id });
    assert.equal(entrada.mensagem, 'A luz atrapalha o exame?');
  });
});
