// Layout D: laudo de URINA em colunas ("Rótulo : resultado <TAB> referência") e
// cabeçalho com o rótulo numa linha e o valor na de baixo. No FORMATO de um laudo
// real testado em 04/11/2026 (o arquivo real NÃO está no repositório).
// Tudo aqui é FICTÍCIO. Rodar: npm test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estruturarAnalitos } from '../../src/pipeline/estruturarAnalitos.js';
import { extrairIdentificadores } from '../../src/pipeline/extrairIdentificadores.js';
import { processarTextoLaudo } from '../../src/pipeline/processarLaudo.js';
import { compararDescritivo, separarMetadesIguais } from '../../src/pipeline/resultadosDescritivos.js';

const CABECALHO = [
  'LABORATÓRIO MODELO D (FICTÍCIO)',
  'Paciente: MARIA TESTE LU',
  'Nome Social:',
  'CPF',
  '00000000000',
  'Idade',
  '34 (A)',
  'Médico',
  'JOAO EXEMPLO Local Coleta',
  'Nascimento',
  '14/03/1992',
  'RESULTADO',
];

const TEXTO = [
  ...CABECALHO,
  'UROCULTURA - CULTURA DE URINA',
  'Resultado \t: Não houve crescimento bacteriano.',
  'Material de Coleta : Urina',
  'V.R. \t: Não houve crescimento bacteriano.',
  'Nossos antibiogramas seguem as normas BrCast 2025.',
  'Folha: 1 de 2',
  ...CABECALHO,
  'URINA I',
  'Caracteres Físicos \tValor Referência',
  'Cor \t: Amarelo Claro \tAmarelo Claro',
  'Densidade \t: 1.010 \t1.005 a 1.030',
  'pH \t: 5,0 \t5,0 a 8,0',
  'Proteínas \t: Positivo \tNegativo',
  'Glicose \t: Negativo \tNegativo',
  'Urobilinogênio \t: Normal \t< 1 mg/dL',
  'Bilirrubina \t: Traços \t< 1 mg/dL',
  'Hemoglobina \t: Negativo \tNegativo',
  'Leucócitos \t: 1.000 \tAté 10.000 /mL',
  'Hemácias \t: <1.000 \tAté 3.000 /mL',
  'Cilindros Hialinos \t: Ausentes \tAté 200 /mL',
  'Cilindros não Classificados : Ausentes \tAusentes',
  'Amostra : Urina',
  'Folha: 2 de 2',
].join('\n');

const descritivo = (lista, nome) => lista.find((d) => d.nome_no_laudo === nome);

describe('Layout D: resultados descritivos', () => {
  const { descritivos, analitos } = estruturarAnalitos(TEXTO);

  it('igual à referência → conforme; diferente → diferente_da_referencia', () => {
    assert.equal(descritivo(descritivos, 'Cor').situacao, 'conforme_referencia');
    assert.equal(descritivo(descritivos, 'Glicose').situacao, 'conforme_referencia');
    assert.deepEqual(descritivo(descritivos, 'Proteínas'), {
      nome_no_laudo: 'Proteínas', resultado: 'Positivo', referencia: 'Negativo', situacao: 'diferente_da_referencia',
    });
  });
  it('nome sem TAB antes do ":" também é lido ("Cilindros não Classificados : Ausentes")', () => {
    assert.equal(descritivo(descritivos, 'Cilindros não Classificados').situacao, 'conforme_referencia');
  });
  it('ausência × limite superior numérico → conforme ("Ausentes" × "Até 200 /mL", "Normal" × "< 1 mg/dL")', () => {
    assert.equal(descritivo(descritivos, 'Cilindros Hialinos').situacao, 'conforme_referencia');
    assert.equal(descritivo(descritivos, 'Urobilinogênio').situacao, 'conforme_referencia');
  });
  it('outra palavra × faixa numérica NÃO é decidida ("Traços" × "< 1 mg/dL")', () => {
    assert.equal(descritivo(descritivos, 'Bilirrubina'), undefined);
    assert.ok(!analitos.some((a) => a.nome_no_laudo === 'Bilirrubina'));
  });
  it('valor com sinal só é decidido quando todo valor abaixo cabe na faixa ("<1.000" × "Até 3.000")', () => {
    assert.equal(descritivo(descritivos, 'Hemácias').situacao, 'conforme_referencia');
  });
  it('urocultura: "Resultado :" e "V.R. :" em linhas separadas → par com o nome acima', () => {
    assert.equal(descritivo(descritivos, 'UROCULTURA - CULTURA DE URINA').situacao, 'conforme_referencia');
  });
  it('compararDescritivo ignora acento, maiúscula e plural; separarMetadesIguais só aceita metades iguais', () => {
    assert.equal(compararDescritivo('NÃO REAGENTE', 'Não reagente'), 'conforme_referencia');
    assert.equal(compararDescritivo('Ausente', 'Ausentes'), 'conforme_referencia');
    assert.deepEqual(separarMetadesIguais('Não Reagente Não reagente'), { resultado: 'Não Reagente', referencia: 'Não reagente' });
    assert.equal(separarMetadesIguais('Reagente Não reagente'), null);
  });
});

describe('Layout D: números da urina', () => {
  const { analitos } = estruturarAnalitos(TEXTO);
  const porNome = (nome) => analitos.find((a) => a.nome_no_laudo === nome);

  it('densidade "1.010" é 1,010 (ponto decimal), nunca mil e dez', () => {
    assert.equal(porNome('Densidade').valor, 1.01);
    assert.deepEqual([porNome('Densidade').faixa_referencia.minimo, porNome('Densidade').faixa_referencia.maximo], [1.005, 1.03]);
  });
  it('pH e densidade não têm unidade e isso não reduz a confiança (adimensional)', () => {
    assert.equal(porNome('pH').confianca, 1);
    assert.equal(porNome('pH').adimensional, true);
  });
  it('leucócitos: unidade tirada do fim da referência ("Até 10.000 /mL")', () => {
    assert.deepEqual([porNome('Leucócitos').valor, porNome('Leucócitos').unidade], [1000, '/mL']);
  });
  it('tudo da seção de urina sai com material "urina"', () => {
    assert.ok(analitos.every((a) => a.material === 'urina'));
  });
});

describe('Layout D: laudo inteiro', () => {
  const r = processarTextoLaudo(TEXTO, { origem: 'pdf_digital' });

  it('segue, com os números classificados e os descritivos separados', () => {
    assert.equal(r.status, 'ok', JSON.stringify(r.erro));
    assert.deepEqual(r.laudo.analitos.map((a) => [a.nome_no_laudo, a.classificacao]), [['Densidade', 'dentro'], ['pH', 'dentro'], ['Leucócitos', 'dentro']]);
    assert.equal(r.laudo.itens_descritivos.length, 9);
  });
  it('"Glicose" e "Hemoglobina" da URINA não são ligados às fichas de sangue', () => {
    const urina = processarTextoLaudo(TEXTO.replace('Hemoglobina \t: Negativo \tNegativo', 'Hemoglobina \t: 0,5 \tAté 1,0 mg/dL'));
    assert.equal(urina.laudo.analitos.find((a) => a.nome_no_laudo === 'Hemoglobina').id_canonico, null);
  });
  it('a frase "Nossos antibiogramas seguem as normas BrCast 2025." não conta como resultado; "Traços" × "< 1 mg/dL" sim', () => {
    assert.deepEqual(estruturarAnalitos(TEXTO).nao_interpretadas.map((l) => l.motivo), ['resultado_descritivo_com_faixa_numerica']);
  });
});

describe('Layout D: identificadores com o rótulo numa linha e o valor na de baixo', () => {
  const id = extrairIdentificadores(TEXTO);
  it('nome, CPF, nascimento e médico (sem a coluna "Local Coleta")', () => {
    assert.deepEqual([id.paciente, id.cpf, id.nascimento, id.medico], ['MARIA TESTE LU', '00000000000', '14/03/1992', 'JOAO EXEMPLO']);
  });
  it('nenhum deles aparece no laudo estruturado (nem nos descritivos)', () => {
    const laudo = JSON.stringify(processarTextoLaudo(TEXTO).laudo);
    for (const valor of ['MARIA', '00000000000', '14/03/1992', 'JOAO']) assert.ok(!laudo.includes(valor), valor);
  });
});
