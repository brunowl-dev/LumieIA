// Resultados DESCRITIVOS (qualitativos) do laudo: "Proteínas : Negativo  Negativo",
// "Cor : Amarelo Claro  Amarelo Claro", "VDRL Resultado: Não Reagente Não reagente".
// Só regra determinística, sem o modelo: o resultado é comparado com a referência
// impressa no laudo e sai "conforme a referência" ou "diferente da referência".
// Não há explicação por IA para eles (não têm ficha, nem valor numérico).
import { normalizarTexto } from './normalizarNome.js';

export const SITUACOES = Object.freeze({
  CONFORME: 'conforme_referencia',
  DIFERENTE: 'diferente_da_referencia',
});

// Palavras que dizem "não há" / "normal". Com uma referência numérica de LIMITE
// SUPERIOR ("Até 200 /mL", "< 1 mg/dL"), estão conformes: zero cabe em "até 200".
const AUSENCIA = new Set(['ausente', 'ausentes', 'negativo', 'negativa', 'nulo', 'nula', 'nao detectado', 'nao detectavel', 'normal']);

// Rótulos de cabeçalho que nunca são exame (um "Pedido : 123  Solicitante: ..." não pode virar resultado).
const NAO_E_EXAME = /^(?:paciente|nome(?:\s+social)?|cpf|rg|m[ée]dico|solicitante|pedido|protocolo|ficha|conv[êe]nio|idade|sexo|nascimento|data\b.*|emiss[ãa]o|amostra|m[ée]todo|material(?:\s+de\s+coleta)?|coment[áa]rio|origem|laudo|local\b.*|assinatura\b.*)$/i;

// Mesmo texto, ignorando acento, maiúscula, pontuação e o "s" do plural.
const comparavel = (texto) => normalizarTexto(texto).split(' ').map((p) => p.replace(/s$/, '')).join(' ');

/** "Negativo" × "Negativo" → conforme; "Positivo" × "Negativo" → diferente. */
export function compararDescritivo(resultado, referencia) {
  return comparavel(resultado) === comparavel(referencia) ? SITUACOES.CONFORME : SITUACOES.DIFERENTE;
}

/** O resultado é uma palavra de ausência ("Ausentes", "Normal")? */
export function eAusencia(resultado) {
  return AUSENCIA.has(normalizarTexto(resultado));
}

/**
 * Linha "Rótulo : resultado <TAB> referência" (laudo em colunas, como o de urina).
 * Usa a linha BRUTA: é a tabulação que separa o resultado da referência
 * ("Amarelo Claro<TAB>Amarelo Claro"); com os espaços juntados não daria.
 * @returns {{ nome: string, resultado: string, referencia: string } | null}
 */
export function lerLinhaEmColunas(linhaBruta) {
  // ^ nome (sem ":" nem TAB, com letra)  :  resultado (sem TAB)  TAB  referência $
  const encontrado = /^\s*([^:\t]*\p{L}[^:\t]*?)\s*\t?\s*:\s*([^\t]*?)\s*\t\s*(\S.*?)\s*$/u.exec(linhaBruta ?? '');
  if (!encontrado) return null;
  const [, nome, resultado, referencia] = encontrado;
  if (!resultado || NAO_E_EXAME.test(nome.trim()) || referencia.includes(':')) return null;
  return { nome: nome.replace(/\s+/g, ' ').trim(), resultado: resultado.replace(/\s+/g, ' '), referencia: referencia.replace(/\s+/g, ' ') };
}

/**
 * "Não Reagente Não reagente": resultado e referência impressos lado a lado, sem
 * separador. Só aceita quando as duas metades são o MESMO texto (conforme);
 * metades diferentes não dá para separar com segurança.
 * @returns {{ resultado: string, referencia: string } | null}
 */
export function separarMetadesIguais(texto) {
  const palavras = texto.trim().split(/\s+/);
  if (palavras.length < 2 || palavras.length % 2 !== 0) return null;
  const metade = palavras.length / 2;
  const resultado = palavras.slice(0, metade).join(' ');
  const referencia = palavras.slice(metade).join(' ');
  return comparavel(resultado) === comparavel(referencia) ? { resultado, referencia } : null;
}

/** Item descritivo pronto para o laudo (contrato §2.7). */
export function itemDescritivo(nome, resultado, referencia, situacao = compararDescritivo(resultado, referencia)) {
  return { nome_no_laudo: nome, resultado, referencia, situacao };
}
