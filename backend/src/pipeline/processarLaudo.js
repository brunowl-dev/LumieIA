// Pipeline completo do momento 1 (envio do laudo, sem IA):
// texto → analitos (BWL-03) → id_canonico (BWL-04) → confiança (BWL-06)
// → classificação e alerta crítico (BWL-05) → laudo estruturado (contrato §2).
// A saída é montada campo a campo (lista do que ENTRA): nada do texto bruto,
// nem nao_interpretadas, nem dados do paciente. A prova formal disso é a BWL-07.
import { randomUUID } from 'node:crypto';
import { estruturarAnalitos } from './estruturarAnalitos.js';
import { extrairTextoPdf } from './extrairTextoPdf.js';
import { carregarIndiceDeNomes, normalizarNomeExame } from './normalizarNome.js';
import { carregarLimitesCriticos, classificarAnalito, normalizarUnidade, unidadeCompativel } from './classificar.js';
import {
  AVISO_ITENS_NAO_LIDOS, ORIGENS, avaliarConfiancaAnalito, avaliarConfiancaLaudo,
} from './confianca.js';
import {
  CAMINHO_BASE_CONHECIMENTO, CAMINHO_LIMITES_CRITICOS, CONFIANCA_MINIMA_EXTRACAO, CONFIANCA_MINIMA_OCR,
} from './config.js';

let dadosCarregados = null;

/**
 * Base de conhecimento e limites críticos, lidos do disco uma vez só.
 * Falha alto (com mensagem clara) se algum arquivo estiver malformado.
 */
export function carregarDadosDoPipeline() {
  dadosCarregados ??= {
    indiceNomes: carregarIndiceDeNomes(CAMINHO_BASE_CONHECIMENTO),
    limites: carregarLimitesCriticos(CAMINHO_LIMITES_CRITICOS),
  };
  return dadosCarregados;
}

/**
 * Processa o texto de um laudo.
 * @param {string} texto texto extraído (PDF ou OCR). Contém dados do paciente:
 *   não sai desta função.
 * @param {{ origem?: 'pdf_digital'|'ocr', confiancaOcr?: number|null,
 *   indiceNomes?: Map, limites?: object, limiar?: number, limiarOcr?: number,
 *   idLaudo?: string }} [opcoes]
 * @returns {{ status: 'ok', laudo: object } | { status: 'erro', erro: object }}
 */
export function processarTextoLaudo(texto, opcoes = {}) {
  const {
    origem = ORIGENS.PDF_DIGITAL,
    confiancaOcr = null,
    limiar = CONFIANCA_MINIMA_EXTRACAO,
    limiarOcr = CONFIANCA_MINIMA_OCR,
    idLaudo = randomUUID(),
  } = opcoes;
  const { indiceNomes, limites } = opcoes.indiceNomes && opcoes.limites
    ? opcoes
    : carregarDadosDoPipeline();

  // 1) Estruturação e 2) nome canônico.
  const estruturado = estruturarAnalitos(texto);
  const analitos = estruturado.analitos.map((analito) => {
    const comId = { ...analito, id_canonico: normalizarNomeExame(analito.nome_no_laudo, indiceNomes).id_canonico };
    // 3) Confiança de cada item.
    return { ...comId, avaliacao: avaliarConfiancaAnalito(comId, { origem, limiar, confiancaOcrLaudo: confiancaOcr }) };
  });

  // 3) Confiança do laudo: segue ou pede novo envio.
  const decisao = avaliarConfiancaLaudo(
    { analitos, nao_interpretadas: estruturado.nao_interpretadas },
    { origem, limiar, limiarOcr, confiancaOcrLaudo: confiancaOcr },
  );
  if (!decisao.segue) return decisao.erro;

  const { confiaveis, naoLidos } = separarRepetidos(analitos);

  // 4) Classificação, só dos confiáveis.
  const saida = confiaveis.map((analito) => {
    const resultado = classificarAnalito(analito, limites);
    const avisos = [];
    const unidades = limites.analitos[analito.id_canonico]?.unidades_aceitas;
    if (unidadeCompativel(analito.unidade, unidades) === false) avisos.push('unidade_diferente_da_esperada');
    return {
      id_canonico: analito.id_canonico,
      nome_no_laudo: analito.nome_no_laudo,
      valor: analito.valor,
      unidade: analito.unidade,
      faixa_referencia: {
        minimo: analito.faixa_referencia.minimo,
        maximo: analito.faixa_referencia.maximo,
        minimo_inclusivo: analito.faixa_referencia.minimo_inclusivo,
        maximo_inclusivo: analito.faixa_referencia.maximo_inclusivo,
        texto_original: analito.faixa_referencia.texto_original,
      },
      classificacao: resultado.classificacao,
      alerta_critico: resultado.alerta_critico,
      limite_critico: resultado.limite_critico,
      confianca: analito.avaliacao.confianca,
      avisos,
    };
  });

  const linhasNaoInterpretadas = estruturado.nao_interpretadas.length;
  const temItemDeFora = naoLidos.length > 0 || linhasNaoInterpretadas > 0;
  return {
    status: 'ok',
    laudo: {
      id_laudo: idLaudo,
      origem,
      confianca_extracao: decisao.confianca_extracao,
      analitos: saida,
      // Caso misto: o que ficou de fora vai sinalizado, SEM valor.
      itens_nao_lidos: naoLidos,
      linhas_nao_interpretadas: linhasNaoInterpretadas,
      aviso_usuario: temItemDeFora ? AVISO_ITENS_NAO_LIDOS : null,
    },
  };
}

// Um mesmo id_canonico aparece no máximo uma vez por laudo (contrato §2).
// Repetido com o mesmo valor e unidade: fica o primeiro. Repetido com valores
// diferentes: não escolhemos um, todos saem como não lidos.
// A ordem de saída é a ordem impressa no laudo.
function separarRepetidos(analitos) {
  const mesmoResultado = (a, b) => a.valor === b.valor
    && normalizarUnidade(a.unidade) === normalizarUnidade(b.unidade);
  // 1ª passada: o primeiro confiável de cada id e os ids em conflito.
  const primeiroPorId = new Map();
  const emConflito = new Set();
  for (const analito of analitos) {
    const id = analito.id_canonico;
    if (!analito.avaliacao.confiavel || id === null) continue;
    if (!primeiroPorId.has(id)) primeiroPorId.set(id, analito);
    else if (!mesmoResultado(primeiroPorId.get(id), analito)) emConflito.add(id);
  }
  // 2ª passada: separa, na ordem do laudo.
  const confiaveis = [];
  const naoLidos = [];
  for (const analito of analitos) {
    const id = analito.id_canonico;
    if (!analito.avaliacao.confiavel) naoLidos.push(itemNaoLido(analito, analito.avaliacao.motivos));
    else if (id === null) confiaveis.push(analito);
    else if (emConflito.has(id)) naoLidos.push(itemNaoLido(analito, ['exame_repetido_com_valores_diferentes']));
    else if (primeiroPorId.get(id) === analito) confiaveis.push(analito);
    // senão: repetição idêntica do primeiro, descartada.
  }
  return { confiaveis, naoLidos };
}

const itemNaoLido = (analito, motivos) => ({
  id_canonico: analito.id_canonico,
  nome_no_laudo: analito.nome_no_laudo,
  motivos,
});

export const MENSAGEM_ARQUIVO_ILEGIVEL = 'Não conseguimos ler o seu exame. Tente enviar de novo, com uma foto mais nítida ou o PDF original do laboratório.';

/**
 * PDF digital de ponta a ponta: extração (BWL-02) + processarTextoLaudo.
 * PDF sem camada de texto (só imagem) iria para o OCR (BWL-10, ainda não
 * feito): por enquanto devolve ARQUIVO_ILEGIVEL. Os ErroExtracaoPdf (vazio,
 * corrompido, protegido) sobem para o orquestrador traduzir (contrato §2.1).
 * @param {Buffer} buffer
 * @param {object} [opcoes] as mesmas de processarTextoLaudo, mais { senha }
 */
export async function processarLaudoPdf(buffer, { senha, ...opcoes } = {}) {
  const extraido = await extrairTextoPdf(buffer, { senha });
  if (!extraido.temCamadaDeTexto) {
    return {
      status: 'erro',
      erro: { codigo: 'ARQUIVO_ILEGIVEL', motivo: 'sem_camada_de_texto', mensagem_usuario: MENSAGEM_ARQUIVO_ILEGIVEL },
    };
  }
  return processarTextoLaudo(extraido.texto, { ...opcoes, origem: ORIGENS.PDF_DIGITAL });
}
