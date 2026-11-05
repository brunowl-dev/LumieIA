// Etapa 3 do pipeline (BWL-04): nome do exame como veio no laudo → id_canonico
// da base de conhecimento, pelos nomes_alternativos de cada ficha.
// Comparação EXATA depois de normalizar (sem acento, sem maiúscula, sem
// pontuação, espaços juntados). Não há "parecido com": nome que não está na
// lista não é adivinhado, volta como não reconhecido.
import { readFileSync } from 'node:fs';

/**
 * Deixa o nome numa forma comparável: "GLICOSE EM JEJUM", "Glicose em jejum"
 * e "glicose  em jejum." viram todos "glicose em jejum".
 * @param {string} texto
 * @returns {string} '' se não for texto
 */
export function normalizarTexto(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    // NFD separa a letra do acento: "é" vira "e" + "´" (acento à parte).
    .normalize('NFD')
    // \p{M} = marcas (os acentos soltos pelo NFD). Tirá-los remove o acento.
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // Tudo que não é letra nem dígito (pontuação, hífen, parênteses) vira espaço.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Valida a base e monta o índice "nome normalizado → id_canonico".
 * Usa TODAS as fichas, inclusive as "pendente": reconhecer o exame não depende
 * da revisão do texto da explicação (decisão em docs/contrato.md §3). Quem
 * decide se há explicação é o orquestrador, pelo status da ficha.
 * @param {object} base conteúdo de exames.json
 * @returns {Map<string, string>}
 * @throws {Error} base malformada ou mesmo nome em duas fichas
 */
export function criarIndiceDeNomes(base) {
  if (!base || !Array.isArray(base.exames)) {
    throw new Error('Base de conhecimento malformada: falta a lista "exames".');
  }
  const indice = new Map();
  base.exames.forEach((ficha, posicao) => {
    const id = ficha?.id_canonico;
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(`Base de conhecimento: a ficha nº ${posicao + 1} não tem id_canonico.`);
    }
    if (!Array.isArray(ficha.nomes_alternativos)) {
      throw new Error(`Base de conhecimento: a ficha "${id}" não tem a lista nomes_alternativos.`);
    }
    // O próprio id também vale como nome ("colesterol_total" → "colesterol total").
    for (const nome of [id, ...ficha.nomes_alternativos]) {
      const chave = normalizarTexto(nome);
      if (chave === '') continue;
      const jaUsado = indice.get(chave);
      if (jaUsado && jaUsado !== id) {
        // Um nome que leva a dois exames tornaria o resultado um chute.
        throw new Error(`Base de conhecimento: o nome "${nome}" aparece em "${jaUsado}" e em "${id}".`);
      }
      indice.set(chave, id);
    }
  });
  return indice;
}

/**
 * Lê exames.json do disco e monta o índice. Falha com mensagem clara se o
 * arquivo não existir ou não for JSON válido (contrato §3).
 * @param {string} caminho
 * @returns {Map<string, string>}
 */
export function carregarIndiceDeNomes(caminho) {
  let base;
  try {
    base = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (erro) {
    throw new Error(`Não foi possível ler a base de conhecimento em "${caminho}": ${erro.message}`, { cause: erro });
  }
  return criarIndiceDeNomes(base);
}

/**
 * Reconhece o exame pelo nome impresso no laudo. Nunca lança erro.
 * @param {string} nomeNoLaudo ex.: "GLICEMIA JEJUM"
 * @param {Map<string, string>} indice saída de criarIndiceDeNomes
 * @returns {{ reconhecido: boolean, id_canonico: string|null, nome_normalizado: string }}
 */
export function normalizarNomeExame(nomeNoLaudo, indice) {
  const nomeNormalizado = normalizarTexto(nomeNoLaudo);
  const id = indice.get(nomeNormalizado) ?? idPelasPartes(nomeNoLaudo, indice);
  return { reconhecido: id !== null, id_canonico: id, nome_normalizado: nomeNormalizado };
}

// "Sigla - nome por extenso" ("TSH - HORMÔNIO TIREOESTIMULANTE"): cada parte
// separada por " - " é procurada (ainda comparação EXATA). Só aceita se todas
// as partes reconhecidas levarem ao MESMO exame; se levarem a dois, não escolhe.
function idPelasPartes(nomeNoLaudo, indice) {
  if (typeof nomeNoLaudo !== 'string' || !/\s[-–]\s/.test(nomeNoLaudo)) return null;
  const ids = new Set(
    nomeNoLaudo.split(/\s[-–]\s/).map((parte) => indice.get(normalizarTexto(parte))).filter(Boolean),
  );
  return ids.size === 1 ? [...ids][0] : null;
}
