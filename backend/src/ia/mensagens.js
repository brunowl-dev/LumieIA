// MONTAGEM DAS MENSAGENS ENVIADAS AO MODELO (ISA-04, contrato §4.1 e §4.6).
// system = o prompt versionado (como responder); user = SÓ a entrada, já
// pseudonimizada pelo orquestrador (os dados do exame). A ficha da base já vem
// dentro da entrada: aqui não se lê exames.json nem nada do paciente.

import { carregarPrompt } from './prompts.js';

/**
 * @param {'explicacao' | 'chat'} nomePrompt
 * @param {object} entrada a entrada da §4.2, enviada sem alteração
 * @param {string[]} [motivosReprovacao] códigos da §8 da tentativa anterior
 *   (as instruções de correção por código entram na ISA-06)
 * @returns {{ system: string, user: string }}
 */
export function montarMensagens(nomePrompt, entrada, motivosReprovacao = []) {
  return {
    system: carregarPrompt(nomePrompt),
    user: JSON.stringify(entrada),
  };
}
