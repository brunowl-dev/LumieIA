// IA FALSA (BWL-09): fica no lugar do modelo até o código da Isadora (ISA-01 a
// 05) chegar. Devolve respostas no formato do contrato §4, montadas só a partir
// da entrada que recebeu (já pseudonimizada). NÃO chama rede nem modelo.
//
// Ela ignora os motivos de reprovação (corrigir a partir deles é a ISA-06): com a
// IA falsa, a correção na regeneração é só simulada nos testes.
// Quando a IA real chegar, troca-se o cliente em src/server.js; nada mais muda.
import { AVISO_PADRAO } from '../seguranca/mensagemPadrao.js';

const POSICAO = { dentro: 'dentro da faixa', acima: 'acima da faixa', abaixo: 'abaixo da faixa' };
const formatar = (n) => String(n).replace('.', ',');

function faixaEmTexto({ minimo, maximo, maximo_inclusivo: maxInc, minimo_inclusivo: minInc }, unidade) {
  if (minimo != null && maximo != null) return `de ${formatar(minimo)} a ${formatar(maximo)} ${unidade}`;
  if (maximo != null) return `${maxInc ? 'até' : 'inferior a'} ${formatar(maximo)} ${unidade}`;
  return `${minInc ? 'a partir de' : 'superior a'} ${formatar(minimo)} ${unidade}`;
}

export function criarIaFalsa() {
  return {
    /** Contrato §4.1: as 5 partes. */
    async gerarExplicacao(entrada) {
      const { analito, ficha } = entrada;
      const significado = analito.classificacao === 'dentro'
        ? 'A interpretação do resultado depende do seu histórico e de outros exames, avaliados por um profissional de saúde.'
        : 'Valores fora da faixa merecem atenção e costumam ser avaliados junto com outras informações, como histórico e outros exames. Este resultado, sozinho, não permite afirmar nenhuma condição.';
      return {
        o_que_avalia: ficha.o_que_avalia,
        valor_e_posicao: `Seu resultado foi ${formatar(analito.valor)} ${analito.unidade}. A faixa de referência do seu laudo é `
          + `${faixaEmTexto(analito.faixa_referencia, analito.unidade)}, então o valor está ${POSICAO[analito.classificacao]}.`,
        significado: analito.alerta_critico
          ? `${significado} Este resultado recebeu um alerta de atendimento prioritário: procure um serviço de saúde assim que possível.`
          : significado,
        especialidade: ficha.especialidade,
        aviso: AVISO_PADRAO,
      };
    },

    /** Contrato §4.2: { resposta }, terminando com o aviso. Texto fixo, que se declara simulado. */
    async responderChat(entrada) {
      return {
        resposta: 'Resposta simulada: o modelo de linguagem ainda não está ligado a este protótipo. '
          + `Sobre este exame: ${entrada.ficha.o_que_avalia} `
          + `Para dúvidas sobre o seu resultado, a especialidade indicada é ${entrada.ficha.especialidade}. ${AVISO_PADRAO}`,
      };
    },
  };
}
