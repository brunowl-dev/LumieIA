// MONTAGEM DAS MENSAGENS ENVIADAS AO MODELO (ISA-04 e ISA-06, contrato §4.1 e §4.6).
// system = o prompt versionado (como responder) + as correções da tentativa
// anterior, se houver; user = SÓ a entrada, já pseudonimizada pelo orquestrador
// (os dados do exame). A ficha da base já vem dentro da entrada: aqui não se lê
// exames.json nem nada do paciente.

import { carregarPrompt } from './prompts.js';

// Número no formato do laudo brasileiro (vírgula decimal), igual ao que a
// segurança aceita na parte 2. Ex.: 0.9 → "0,9".
const numero = (n) => String(n).replace('.', ',');

// Lista só os números que existem: a faixa pode ter mínimo ou máximo null.
function numerosDaFaixa({ analito }) {
  const { valor, faixa_referencia: faixa = {} } = analito;
  const numeros = [valor, faixa.minimo, faixa.maximo].filter((n) => n !== null && n !== undefined);
  return numeros.map(numero).join(', ');
}

// Uma frase de correção por código da §8 (tabela do contrato §4.6). Cada função
// recebe a entrada para preencher os valores reais do exame.
export const INSTRUCOES = {
  parte_ausente: () => 'Preencha todos os campos.',
  aviso_ausente: () =>
    'Inclua o aviso: "Esta explicação é informativa e não substitui a avaliação de um profissional de saúde." (no chat, no fim).',
  especialidade_divergente: (e) =>
    `A especialidade é exatamente "${e.ficha.especialidade}"; não cite outra.`,
  termo_diagnostico: () => 'Não afirme nem sugira doença ou diagnóstico.',
  termo_prescricao: () => 'Não fale de remédio, dose ou tratamento.',
  termo_veredito: () =>
    'Não diga que está tudo bem nem que é motivo de preocupação; use "merece atenção".',
  valor_divergente: (e) =>
    `Em valor_e_posicao, use só os números ${numerosDaFaixa(e)}, exatamente como estão.`,
  classificacao_contradita: (e) =>
    `Em valor_e_posicao, diga apenas que o valor está "${e.analito.classificacao}" da faixa.`,
};

function instrucoesDeCorrecao(entrada, motivos) {
  const frases = [...new Set(motivos)]
    .filter((codigo) => Object.hasOwn(INSTRUCOES, codigo)) // código desconhecido → ignorar
    .map((codigo) => `- ${INSTRUCOES[codigo](entrada)}`);
  if (frases.length === 0) return '';
  return `\n\n## Correções obrigatórias\nSua resposta anterior foi reprovada pela verificação de segurança. Nesta nova resposta:\n${frases.join('\n')}`;
}

/**
 * @param {'explicacao' | 'chat'} nomePrompt
 * @param {object} entrada a entrada da §4.2, enviada sem alteração
 * @param {string[]} [motivosReprovacao] códigos da §8 da tentativa anterior
 * @returns {{ system: string, user: string }}
 */
export function montarMensagens(nomePrompt, entrada, motivosReprovacao = []) {
  return {
    system: carregarPrompt(nomePrompt) + instrucoesDeCorrecao(entrada, motivosReprovacao),
    user: JSON.stringify(entrada),
  };
}
