// Etapa 1 do pipeline para FOTO ou laudo DIGITALIZADO (BWL-10): OCR com Tesseract.js.
// Só lê. Não interpreta valores (BWL-03) nem corrige o texto (corrigirTextoOcr.js).
// Não grava log: o texto é dado de saúde.
//
// O OCR roda AQUI, no servidor (WebAssembly dentro do Node): a imagem não sai
// para nenhum serviço externo. A rede só é usada fora do Docker, uma única vez,
// para baixar os arquivos de idioma (não os dados do paciente).
//
// "Worker" = o Tesseract rodando numa thread separada. Criar um leva ~1 s (carrega
// o motor e os idiomas), então criamos UM na primeira leitura e reaproveitamos.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorker, OEM } from 'tesseract.js';
import { CAMINHO_TESSDATA, OCR_IDIOMAS } from './config.js';

export const CODIGOS_ERRO_OCR = Object.freeze({
  IMAGEM_INVALIDA: 'IMAGEM_INVALIDA', // corrompida, vazia ou formato que o Tesseract não abre
});

export class ErroOcr extends Error {
  constructor(codigo, mensagem, opcoes) {
    super(mensagem, opcoes);
    this.name = 'ErroOcr';
    this.codigo = codigo;
  }
}

let workerPromise = null;

// Sem errorHandler, o Tesseract.js rejeita a promessa E ainda lança o mesmo erro
// fora dela (exceção não capturada), o que DERRUBA o servidor com uma imagem
// corrompida. Com ele, o erro chega só pela promessa, tratada em extrairTextoImagem.
const ignorarErroJaRejeitado = () => {};

function opcoesDoWorker() {
  const comuns = { errorHandler: ignorarErroJaRejeitado };
  // Docker: idiomas já na imagem e nada é gravado em disco (cacheMethod 'none').
  if (CAMINHO_TESSDATA) return { ...comuns, langPath: CAMINHO_TESSDATA, cacheMethod: 'none' };
  // Fora do Docker: baixa da CDN do Tesseract.js e guarda na pasta temporária do sistema.
  return { ...comuns, cachePath: join(tmpdir(), 'lumie-tessdata') };
}

function obterWorker() {
  // ??= : só cria se ainda não existe. Se a criação falhar, esquece a promessa
  // para a próxima leitura tentar de novo em vez de repetir o mesmo erro.
  workerPromise ??= createWorker(OCR_IDIOMAS, OEM.LSTM_ONLY, opcoesDoWorker()).catch((erro) => {
    workerPromise = null;
    throw erro;
  });
  return workerPromise;
}

/** Cria o worker já na subida do servidor: a 1ª foto não espera e erro de idioma aparece cedo. */
export async function aquecerOcr() {
  await obterWorker();
}

/** Encerra o worker (testes e desligamento do servidor). */
export async function encerrarOcr() {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  await worker?.terminate();
}

/**
 * Lê o texto de uma imagem (JPG ou PNG).
 * @param {Buffer} imagem
 * @returns {Promise<{ texto: string, confianca: number }>}
 *   confianca = média da página, na escala do Tesseract (0 a 100).
 * @throws {ErroOcr}
 */
export async function extrairTextoImagem(imagem) {
  const worker = await obterWorker();
  let data;
  try {
    ({ data } = await worker.recognize(imagem));
  } catch (erro) {
    throw new ErroOcr(CODIGOS_ERRO_OCR.IMAGEM_INVALIDA, 'Não foi possível ler a imagem.', { cause: erro });
  }
  return { texto: data.text ?? '', confianca: data.confidence ?? 0 };
}

/**
 * Junta o OCR de várias páginas (PDF digitalizado) num resultado só.
 * A confiança é a média das páginas: uma página ilegível puxa o laudo para baixo.
 */
export function juntarPaginasOcr(paginas) {
  if (paginas.length === 0) return { texto: '', confianca: 0 };
  return {
    texto: paginas.map((p) => p.texto).join('\n'),
    confianca: paginas.reduce((soma, p) => soma + p.confianca, 0) / paginas.length,
  };
}
