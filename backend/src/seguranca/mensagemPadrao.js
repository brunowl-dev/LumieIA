// Mensagem padrão (BWL-08): usada quando a segurança reprova todas as tentativas.
// Montada SEM o modelo, só com a ficha da base, os números do pipeline e textos
// fixos. Por isso é segura por construção, e mesmo assim os testes conferem que
// ela passa na própria camada (verificarExplicacao / verificarChat).

// Contrato §9.
export const AVISO_PADRAO = 'Esta explicação é informativa e não substitui a avaliação de um profissional de saúde.';

const POSICAO = { dentro: 'dentro da faixa', acima: 'acima da faixa', abaixo: 'abaixo da faixa' };

// 0.9 → "0,9" (vírgula decimal, como no laudo).
// Como o paciente lê: vírgula decimal e ponto de milhar ("329.000", "5,8").
// A verificação lê os dois formatos (numerosDoTexto em verificarResposta.js).
const formatar = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 10 });

// A faixa escrita a partir dos limites do pipeline (não do texto do laudo).
function descreverFaixa({ minimo, maximo, minimo_inclusivo: minInc, maximo_inclusivo: maxInc }, unidade) {
  const u = unidade ? ` ${unidade}` : '';
  if (minimo != null && maximo != null) return `de ${formatar(minimo)} a ${formatar(maximo)}${u}`;
  if (maximo != null) return `${maxInc ? 'até' : 'inferior a'} ${formatar(maximo)}${u}`;
  if (minimo != null) return `${minInc ? 'a partir de' : 'superior a'} ${formatar(minimo)}${u}`;
  return null;
}

/**
 * Explicação padrão em 5 partes (contrato §8): finalidade e especialidade da
 * base + valor e posição do pipeline + aviso fixo.
 */
export function montarExplicacaoPadrao(analito, ficha) {
  const unidade = analito.unidade ? ` ${analito.unidade}` : '';
  const faixa = descreverFaixa(analito.faixa_referencia ?? {}, analito.unidade);
  const valorEPosicao = `Seu resultado foi ${formatar(analito.valor)}${unidade}.`
    + (faixa ? ` A faixa de referência do seu laudo é ${faixa}, então o valor está ${POSICAO[analito.classificacao]}.` : '');
  const significado = analito.alerta_critico
    ? 'Este resultado recebeu um alerta de atendimento prioritário. Procure um serviço de saúde assim que possível e leve este laudo.'
    : 'Leve este resultado a um profissional de saúde, que poderá avaliá-lo junto com o seu histórico.';
  return {
    o_que_avalia: ficha.o_que_avalia,
    valor_e_posicao: valorEPosicao,
    significado,
    especialidade: ficha.especialidade,
    aviso: AVISO_PADRAO,
  };
}

/** Resposta padrão do chat (contrato §8): texto fixo + especialidade da base + aviso. */
export function montarChatPadrao(ficha) {
  return {
    resposta: 'Não consegui responder essa dúvida com segurança. Converse com um profissional de saúde.'
      + ` Para este exame, a especialidade indicada é ${ficha.especialidade}. ${AVISO_PADRAO}`,
  };
}
