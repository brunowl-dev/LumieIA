// Configuração do pipeline: o ÚNICO lugar de onde saem os limiares da BWL-06 e
// os caminhos dos arquivos de dados. Valores vêm das variáveis de ambiente
// (.env.example); o padrão abaixo vale quando a variável não existe (testes,
// execução fora do Docker). As funções de lógica recebem estes valores por
// parâmetro, então os testes podem passar outros sem mexer no ambiente.
import { join } from 'node:path';

const RAIZ_DO_REPOSITORIO = join(import.meta.dirname, '..', '..', '..');

// Confiança mínima (0 a 1) de um analito e do laudo inteiro. Abaixo disso o
// item não é classificado e, se o laudo todo ficar abaixo, pede-se novo envio.
// 0,80 no PDF digital equivale a "os 4 campos obrigatórios foram lidos" (com 3
// de 4 a confiança é 0,75). Motivo da escolha: docs/confianca-extracao.md.
const PADRAO_CONFIANCA_MINIMA_EXTRACAO = 0.8;

// Confiança média mínima do OCR, na escala do Tesseract (0 a 100). Abaixo disso
// a foto inteira é recusada antes de olhar os analitos (foto borrada).
const PADRAO_CONFIANCA_MINIMA_OCR = 70;

/**
 * Lê um número do ambiente e confere a faixa. Valor inválido é erro de
 * configuração: falhar alto é melhor do que rodar com um limiar errado.
 */
function lerNumero(nome, padrao, minimo, maximo) {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === '') return padrao;
  const valor = Number(bruto);
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new Error(`Variável ${nome}="${bruto}" inválida: use um número de ${minimo} a ${maximo}.`);
  }
  return valor;
}

export const CONFIANCA_MINIMA_EXTRACAO = lerNumero(
  'CONFIANCA_MINIMA_EXTRACAO', PADRAO_CONFIANCA_MINIMA_EXTRACAO, 0, 1,
);
export const CONFIANCA_MINIMA_OCR = lerNumero(
  'CONFIANCA_MINIMA_OCR', PADRAO_CONFIANCA_MINIMA_OCR, 0, 100,
);

// OCR (BWL-10). Idiomas no formato do Tesseract: português + inglês (siglas como TSH).
export const OCR_IDIOMAS = process.env.OCR_LANG?.trim() || 'por+eng';

// Pasta com os arquivos de idioma (<idioma>.traineddata.gz). No Docker eles já
// vêm na imagem (TESSDATA_PATH, ver backend/Dockerfile), então o OCR não usa a
// rede. Fora do Docker fica null: o Tesseract.js baixa uma vez e guarda em cache.
export const CAMINHO_TESSDATA = process.env.TESSDATA_PATH?.trim() || null;

// Base de conhecimento (conteúdo da Aguiar). No Docker é montada em
// /app/knowledge (KNOWLEDGE_BASE_PATH); fora dele, usa o arquivo do repositório.
export const CAMINHO_BASE_CONHECIMENTO = process.env.KNOWLEDGE_BASE_PATH
  || join(RAIZ_DO_REPOSITORIO, 'docs', 'base-conhecimento', 'exames.json');

// Limites críticos por analito, cada um com fonte (BWL-05). Fica junto do código
// do pipeline, separado da lógica.
export const CAMINHO_LIMITES_CRITICOS = join(import.meta.dirname, 'limitesCriticos.json');
