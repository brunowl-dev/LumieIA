// Etapa 4 do pipeline (BWL-06): confiança da extração e erro "envie novamente".
// Roda ANTES da classificação: item em que não confiamos não é classificado
// (nunca chutar valores). Funções puras; os limiares chegam por parâmetro
// (padrão em config.js). Regras e motivo dos números: docs/confianca-extracao.md.

// Sinais objetivos de cada analito. Cada um vale 1 (ok) ou 0 (falhou).
// "nome_reconhecido" só conta no OCR: num PDF digital o texto é exato, então
// nome fora da base é um exame que a base não tem (id_canonico null, segue
// normalmente, contrato §2). Numa foto, nome irreconhecível é sinal de leitura errada.
const SINAIS = [
  { nome: 'nome_presente', motivo: 'nome_ausente', aplica: () => true,
    ok: (a) => typeof a.nome_no_laudo === 'string' && a.nome_no_laudo.trim() !== '' },
  { nome: 'valor_numerico', motivo: 'valor_invalido', aplica: () => true,
    ok: (a) => typeof a.valor === 'number' && Number.isFinite(a.valor) },
  { nome: 'unidade_presente', motivo: 'unidade_ausente', aplica: () => true,
    ok: (a) => typeof a.unidade === 'string' && a.unidade.trim() !== '' },
  { nome: 'faixa_interpretada', motivo: 'faixa_nao_interpretada', aplica: () => true,
    ok: (a) => a.faixa_referencia?.interpretada === true },
  { nome: 'nome_reconhecido', motivo: 'nome_nao_reconhecido', aplica: (origem) => origem === 'ocr',
    ok: (a) => typeof a.id_canonico === 'string' },
];

export const ORIGENS = Object.freeze({ PDF_DIGITAL: 'pdf_digital', OCR: 'ocr' });

// Duas casas: o número exibido é o mesmo que foi comparado com o limiar.
const arredondar = (x) => Math.round(x * 100) / 100;

/**
 * Confiança de UM analito (0 a 1) = sinais ok / sinais que se aplicam,
 * multiplicado pela confiança do OCR (0 a 100 → 0 a 1) quando for foto.
 * @param {object} analito saída da estruturação + id_canonico (BWL-04).
 *   Opcional: confianca_ocr (0-100) da linha, vinda do Tesseract (BWL-10).
 * @param {{ origem: 'pdf_digital'|'ocr', limiar: number, confiancaOcrLaudo?: number|null }} opcoes
 * @returns {{ confianca: number, confiavel: boolean, motivos: string[], sinais: Record<string, boolean> }}
 */
export function avaliarConfiancaAnalito(analito, { origem, limiar, confiancaOcrLaudo = null }) {
  const sinais = {};
  const motivos = [];
  let aplicaveis = 0;
  let atendidos = 0;
  for (const sinal of SINAIS) {
    if (!sinal.aplica(origem)) continue;
    aplicaveis++;
    const ok = sinal.ok(analito);
    sinais[sinal.nome] = ok;
    if (ok) atendidos++;
    else motivos.push(sinal.motivo);
  }

  // Confiança do OCR: a da linha, se o Tesseract deu; senão a média da página.
  let fatorOcr = 1;
  if (origem === ORIGENS.OCR) {
    const ocr = typeof analito.confianca_ocr === 'number' ? analito.confianca_ocr : confiancaOcrLaudo;
    fatorOcr = typeof ocr === 'number' ? Math.min(Math.max(ocr, 0), 100) / 100 : 0;
    if (typeof ocr !== 'number') motivos.push('confianca_ocr_ausente');
  }

  const confianca = arredondar((atendidos / aplicaveis) * fatorOcr);
  const confiavel = confianca >= limiar;
  if (!confiavel && motivos.length === 0) motivos.push('confianca_ocr_baixa');
  return { confianca, confiavel, motivos, sinais };
}

// Mensagens para o paciente (contrato §7). Fixas, sem o modelo.
export const MENSAGENS_BAIXA_CONFIANCA = Object.freeze({
  ocr: 'Não conseguimos ler bem a foto do seu exame. Tente de novo com uma foto nítida, com boa luz, sem sombras e com o laudo inteiro aparecendo, ou envie o PDF original do laboratório.',
  pdf_digital: 'Não conseguimos ler os resultados deste arquivo com segurança. Envie de novo o PDF original do laboratório ou uma foto nítida do laudo.',
  sem_resultados: 'Não encontramos resultados de exame neste arquivo. Confira se enviou o laudo certo e tente de novo.',
});

// Aviso quando o laudo segue, mas alguns resultados ficaram de fora (caso misto).
export const AVISO_ITENS_NAO_LIDOS = 'Não conseguimos ler alguns resultados deste laudo com segurança, por isso eles não aparecem aqui. Confira esses resultados no laudo original ou envie o arquivo de novo.';

/**
 * Erro padronizado do contrato §7.
 * @param {'pdf_digital'|'ocr'} origem
 * @param {string} motivo código interno estável (para teste e depuração; sem dado do paciente)
 */
export function criarErroBaixaConfianca(origem, motivo) {
  let mensagem = origem === ORIGENS.OCR ? MENSAGENS_BAIXA_CONFIANCA.ocr : MENSAGENS_BAIXA_CONFIANCA.pdf_digital;
  if (motivo === 'nenhum_resultado_encontrado' && origem !== ORIGENS.OCR) mensagem = MENSAGENS_BAIXA_CONFIANCA.sem_resultados;
  return { status: 'erro', erro: { codigo: 'BAIXA_CONFIANCA', motivo, mensagem_usuario: mensagem } };
}

/**
 * Decide se o laudo segue. Regras, nesta ordem:
 * 1. OCR com confiança média abaixo de limiarOcr → erro (foto borrada).
 * 2. Nenhuma linha com cara de resultado → erro.
 * 3. confianca_extracao = média da confiança de cada linha de resultado; as
 *    linhas que nem viraram analito (nao_interpretadas) entram com 0.
 *    Abaixo do limiar → erro.
 * 4. Nenhum analito confiável → erro.
 * 5. Senão o laudo SEGUE com os analitos confiáveis; os demais são sinalizados
 *    (sem valor) para o paciente conferir no laudo original.
 * @param {{ analitos: object[], nao_interpretadas: object[] }} estruturado
 *   analitos já com `avaliacao` (saída de avaliarConfiancaAnalito)
 * @param {{ origem: string, limiar: number, limiarOcr: number, confiancaOcrLaudo?: number|null }} opcoes
 * @returns {{ segue: true, confianca_extracao: number } | { segue: false, confianca_extracao: number, erro: object }}
 */
export function avaliarConfiancaLaudo({ analitos, nao_interpretadas: naoInterpretadas }, {
  origem, limiar, limiarOcr, confiancaOcrLaudo = null,
}) {
  const falha = (motivo, confianca = 0) => ({
    segue: false,
    confianca_extracao: confianca,
    erro: criarErroBaixaConfianca(origem, motivo),
  });

  if (origem === ORIGENS.OCR && !(typeof confiancaOcrLaudo === 'number' && confiancaOcrLaudo >= limiarOcr)) {
    return falha('ocr_baixa_confianca');
  }
  const totalLinhas = analitos.length + naoInterpretadas.length;
  if (totalLinhas === 0) return falha('nenhum_resultado_encontrado');

  const soma = analitos.reduce((total, analito) => total + analito.avaliacao.confianca, 0);
  const confianca = arredondar(soma / totalLinhas);
  if (confianca < limiar) return falha('confianca_abaixo_do_minimo', confianca);
  if (!analitos.some((analito) => analito.avaliacao.confiavel)) {
    return falha('nenhum_resultado_confiavel', confianca);
  }
  return { segue: true, confianca_extracao: confianca };
}
