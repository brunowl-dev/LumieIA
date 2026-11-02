// Laço de regeneração (BWL-08, contrato §8). Mora no orquestrador: a IA não
// sabe quantas vezes vai tentar e a segurança não chama a IA.
//
//   tentativa 0: gera → verifica → aprovou? entrega
//   reprovou    → gera de novo PASSANDO OS MOTIVOS → verifica ...  (até maxRegeneracoes vezes)
//   esgotou     → mensagem padrão (montada sem o modelo)
//
// O gerador é INJETADO (uma função): nos testes é uma IA falsa; na aplicação, o
// adaptador da IA (adaptadorIa.js). Erro do gerador (modelo fora do ar) NÃO é
// reprovação: sobe para a rota responder MODELO_INDISPONIVEL.

/**
 * @param {object} p
 * @param {(motivosAnteriores: string[]) => Promise<object>} p.gerar chama a IA
 * @param {(resposta: object) => { aprovada: boolean, motivos: string[] }} p.verificar camada de segurança
 * @param {() => object} p.mensagemPadrao resposta montada sem o modelo
 * @param {number} p.maxRegeneracoes MAX_REGENERACOES
 * @param {(tentativa: number, motivos: string[]) => void} [p.aoReprovar] para o log (só códigos)
 * @returns {Promise<{ conteudo: object, origem_texto: 'modelo'|'mensagem_padrao', tentativas_regeneracao: number }>}
 */
export async function gerarComSeguranca({ gerar, verificar, mensagemPadrao, maxRegeneracoes, aoReprovar = () => {} }) {
  let motivosAnteriores = [];
  for (let tentativa = 0; tentativa <= maxRegeneracoes; tentativa += 1) {
    const resposta = await gerar(motivosAnteriores);
    const { aprovada, motivos } = verificar(resposta);
    if (aprovada) return { conteudo: resposta, origem_texto: 'modelo', tentativas_regeneracao: tentativa };
    aoReprovar(tentativa, motivos);
    motivosAnteriores = motivos;
  }
  // Esgotou. A mensagem padrão também passa pela camada: se não passar, é bug
  // nosso (texto fixo errado), e é melhor falhar alto do que entregar.
  const padrao = mensagemPadrao();
  const conferida = verificar(padrao);
  if (!conferida.aprovada) throw new Error(`Mensagem padrão reprovada pela segurança: ${conferida.motivos.join(', ')}`);
  return { conteudo: padrao, origem_texto: 'mensagem_padrao', tentativas_regeneracao: maxRegeneracoes };
}
