// Sessão em memória por id_laudo (BWL-09). Sem banco de dados.
// Guarda: o laudo estruturado, os identificadores do paciente (só como lista do
// que apagar do chat), o mapa de substituição da pseudonimização e o histórico
// do chat de cada exame. Tudo some quando a sessão expira.
//
// Expiração: SESSION_TTL_MINUTES sem uso (cada acesso renova o prazo, para a
// sessão não cair no meio de uma conversa). A limpeza periódica apaga as
// expiradas mesmo que ninguém volte a pedir por elas: é isso que garante que os
// identificadores não ficam na memória além do prazo.

/**
 * @param {{ ttlMs: number, agora?: () => number }} opcoes `agora` é injetável para os testes
 */
export function criarSessoes({ ttlMs, agora = Date.now }) {
  const sessoes = new Map();
  const expirou = (sessao) => agora() - sessao.ultimoAcesso > ttlMs;

  function limparExpiradas() {
    for (const [id, sessao] of sessoes) if (expirou(sessao)) sessoes.delete(id);
  }

  return {
    /** Cria a sessão de um laudo recém-processado. */
    criar({ laudo, identificadores }) {
      limparExpiradas();
      const sessao = {
        id_laudo: laudo.id_laudo,
        laudo,
        identificadores: identificadores ?? {},
        mapa: {},
        chats: new Map(), // id_canonico → [{ papel, texto }] (texto já pseudonimizado)
        ultimoAcesso: agora(),
      };
      sessoes.set(sessao.id_laudo, sessao);
      return sessao;
    },

    /** A sessão, ou null se não existe ou expirou (a expirada é apagada aqui). */
    obter(idLaudo) {
      const sessao = sessoes.get(idLaudo);
      if (!sessao) return null;
      if (expirou(sessao)) {
        sessoes.delete(idLaudo);
        return null;
      }
      sessao.ultimoAcesso = agora();
      return sessao;
    },

    /** Histórico do chat de um exame (cria vazio na 1ª vez). */
    historico(sessao, idCanonico) {
      if (!sessao.chats.has(idCanonico)) sessao.chats.set(idCanonico, []);
      return sessao.chats.get(idCanonico);
    },

    limparExpiradas,

    /** Liga a limpeza periódica. `unref` = não segura o processo aberto. Devolve a função que desliga. */
    iniciarLimpezaPeriodica(intervaloMs = 60_000) {
      const timer = setInterval(limparExpiradas, intervaloMs);
      timer.unref();
      return () => clearInterval(timer);
    },

    get quantidade() { return sessoes.size; },
  };
}
