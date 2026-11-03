// CLIENTE DA IA (Isadora, ISA-01 a ISA-06). ESQUELETO: a forma está fechada no
// contrato §4; o conteúdo é a parte da ISA (ver ./CLAUDE.md, "Passo a passo").
//
// Quem chama: só o adaptador (src/api/adaptadorIa.js), que já entrega a entrada
// pseudonimizada, aplica o tempo limite e transforma qualquer erro lançado aqui
// em MODELO_INDISPONIVEL. O servidor usa este cliente quando IA_FALSA=false no .env.

import { chamarOllama } from './ollama.js';
import { montarMensagens } from './mensagens.js';
import { ESQUEMA_EXPLICACAO } from './esquemas.js';

// O texto do modelo vira objeto. Se não for JSON, volta o texto como veio:
// o adaptador e a camada de segurança tratam (contrato §4.7). Nada é completado
// nem corrigido aqui, para a segurança ver exatamente o que o modelo escreveu.
function lerJson(texto) {
  try { return JSON.parse(texto); } catch { return texto; }
}

/**
 * @param {{ fetch?: Function, baseUrl?: string, apiKey?: string, modelo?: string, temperatura?: number }} [opcoes]
 *   Tudo opcional: o padrão vem do ambiente (OLLAMA_BASE_URL, OLLAMA_API_KEY,
 *   OLLAMA_MODEL, OLLAMA_TEMPERATURE) e do fetch global. Os testes passam um fetch falso.
 */
export function criarClienteIa(opcoes = {}) {
  // ISA-01: configuração da chamada. O ambiente é lido AQUI (e não no topo do
  // módulo) para que os testes, que passam `opcoes`, nunca dependam do .env.
  const config = {
    fetch: opcoes.fetch ?? globalThis.fetch,
    baseUrl: opcoes.baseUrl ?? process.env.OLLAMA_BASE_URL,
    apiKey: opcoes.apiKey ?? process.env.OLLAMA_API_KEY,
    modelo: opcoes.modelo ?? process.env.OLLAMA_MODEL,
    temperatura: opcoes.temperatura ?? Number(process.env.OLLAMA_TEMPERATURE),
  };

  return {
    /**
     * Explicação em 5 partes (contrato §4.3).
     * @param {object} entrada { analito, ficha } (contrato §4.2)
     * @param {{ motivosReprovacao?: string[] }} [extra] códigos da §8 da tentativa anterior
     * @returns {Promise<{ o_que_avalia: string, valor_e_posicao: string, significado: string, especialidade: string, aviso: string }>}
     */
    async gerarExplicacao(entrada, { motivosReprovacao = [] } = {}) {
      const { system, user } = montarMensagens('explicacao', entrada, motivosReprovacao);
      const texto = await chamarOllama(config, { system, user, format: ESQUEMA_EXPLICACAO });
      return lerJson(texto);
    },

    /**
     * Resposta a uma dúvida do chat (contrato §4.4).
     * @param {object} entrada { analito, ficha, historico, mensagem } (contrato §4.2)
     * @param {{ motivosReprovacao?: string[] }} [extra]
     * @returns {Promise<{ resposta: string }>}
     */
    async responderChat(entrada, { motivosReprovacao = [] } = {}) {
      throw new Error('IA ainda não implementada (ISA-05)');
    },
  };
}
