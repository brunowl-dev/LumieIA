// ADAPTADOR DA IA (BWL-09): o ÚNICO ponto por onde o backend conversa com a IA.
// Quando o código da Isadora chegar, só este arquivo (e a escolha do cliente em
// server.js) é adaptado.
//
// O que ele garante, para qualquer cliente (falso ou real):
// 1. Pseudonimização na ENTRADA: o cliente nunca recebe nada além do que
//    montarEntradaIa monta (lista de permissão + varredura). Não existe outro
//    caminho do orquestrador até a IA.
// 2. Tempo limite (OLLAMA_TIMEOUT_MS) e erro do cliente → ErroModeloIndisponivel,
//    que a rota traduz para MODELO_INDISPONIVEL (contrato §7).
// 3. A resposta sai no formato do contrato §4 (objeto); texto JSON é convertido.
//
// "cliente" = objeto com gerarExplicacao(entrada, { motivosReprovacao }) e
// responderChat(entrada, { motivosReprovacao }). SUPOSIÇÃO NOSSA: o formato do
// histórico entregue à IA ([{ papel, texto }]) pode mudar quando a parte da
// Isadora existir; ajustar aqui.
import { montarEntradaIa } from '../seguranca/pseudonimizar.js';

export class ErroModeloIndisponivel extends Error {
  constructor(motivo, opcoes) {
    super(`Modelo indisponível: ${motivo}`, opcoes);
    this.name = 'ErroModeloIndisponivel';
    this.codigo = 'MODELO_INDISPONIVEL';
    this.motivo = motivo; // 'tempo_esgotado' | 'erro_do_cliente'
  }
}

/**
 * @param {{ cliente: object, timeoutMs: number }} opcoes
 */
export function criarAdaptadorIa({ cliente, timeoutMs }) {
  async function comTempoLimite(chamada) {
    let timer;
    const tempo = new Promise((_, rejeitar) => {
      timer = setTimeout(() => rejeitar(new ErroModeloIndisponivel('tempo_esgotado')), timeoutMs);
    });
    try {
      return await Promise.race([chamada(), tempo]);
    } catch (erro) {
      throw erro instanceof ErroModeloIndisponivel ? erro : new ErroModeloIndisponivel('erro_do_cliente', { cause: erro });
    } finally {
      clearTimeout(timer);
    }
  }

  // Monta a entrada pseudonimizada e guarda o mapa atualizado na sessão.
  function entradaDa(sessao, dados) {
    const { entrada, mapa } = montarEntradaIa({ ...dados, identificadores: sessao.identificadores, mapa: sessao.mapa });
    sessao.mapa = mapa;
    return entrada;
  }

  return {
    /** Explicação em 5 partes (momento 2). */
    async gerarExplicacao({ sessao, analito, ficha, motivosReprovacao = [] }) {
      const entrada = entradaDa(sessao, { analito, ficha });
      return paraObjeto(await comTempoLimite(() => cliente.gerarExplicacao(entrada, { motivosReprovacao })));
    },

    /** Resposta a uma dúvida do chat (momento 3). */
    async responderChat({ sessao, analito, ficha, mensagem, historico = [], motivosReprovacao = [] }) {
      const entrada = entradaDa(sessao, { analito, ficha, mensagem, historico });
      const resposta = paraObjeto(await comTempoLimite(() => cliente.responderChat(entrada, { motivosReprovacao })));
      return typeof resposta === 'string' ? { resposta } : resposta;
    },
  };
}

// O cliente real pode devolver o JSON como texto. Texto que não é JSON fica
// como está (no chat vira { resposta }; na explicação, a segurança reprova).
function paraObjeto(resposta) {
  if (typeof resposta !== 'string') return resposta;
  try {
    return JSON.parse(resposta);
  } catch {
    return resposta;
  }
}
