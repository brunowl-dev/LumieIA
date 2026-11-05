// Correções do texto lido pelo OCR (BWL-10), ANTES da estruturação (BWL-03).
// Função pura. Só no texto da foto: o PDF digital é exato e não passa por aqui.
//
// Regra: corrigir só confusões de LETRA conhecidas e medidas nas fotos de
// samples/laudos/. NUNCA mexer em dígito: um "8" lido como "3" muda o resultado
// do exame, e isso não se adivinha. Dígito errado fica errado, e quem protege o
// paciente é a confiança (BWL-06), que recusa a leitura ruim.
// Cada correção nova precisa de um caso em test/pipeline/corrigirTextoOcr.test.js.

// Unidades: [lido pelo OCR, correto]. Só a palavra inteira (cercada de espaço
// ou fim de linha), para não trocar pedaço de outra palavra.
const UNIDADES = [
  // O "µ" (micro) é raro nas fontes de treino e sai como H, p ou u.
  ['HUI/mL', 'µUI/mL'],
  ['pUI/mL', 'µUI/mL'],
  ['uUI/mL', 'µUI/mL'],
  // "g" com a perna cortada vira "a" ou "q" (visto no PDF digitalizado).
  ['ma/dL', 'mg/dL'],
  ['mq/dL', 'mg/dL'],
];

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const REGRAS = [
  // Faixa "12,0 a 16,0" lida sem um dos espaços ("12,0a 16,0", "12,0 a16,0").
  // Só entre dois números, onde "a" só pode ser o "a" da faixa.
  [/(\d)a(\s+\d)/g, '$1 a$2'],
  [/(\d\s+)a(\d)/g, '$1a $2'],
  ...UNIDADES.map(([lido, correto]) => [new RegExp(`(^|\\s)${escapar(lido)}(?=\\s|$)`, 'gm'), `$1${correto}`]),
];

/**
 * @param {string} texto texto do OCR (uma linha ou o laudo inteiro)
 * @returns {string} o mesmo texto com as correções acima
 */
export function corrigirTextoOcr(texto) {
  if (typeof texto !== 'string') return '';
  return REGRAS.reduce((atual, [regex, troca]) => atual.replace(regex, troca), texto);
}
