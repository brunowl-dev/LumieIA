// Camada de segurança (BWL-08): confere a resposta do modelo ANTES de ela chegar
// ao paciente. Funções puras: não chamam a IA, não contam tentativas, não logam.
// Devolvem { aprovada, motivos[] }; o laço de regeneração é do orquestrador.
// Tabela verificação → código → exemplo → limite: docs/seguranca-verificacoes.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semAcento } from './pseudonimizar.js';

// Um código por verificação (contrato §8). A ordem aqui é a ordem em `motivos`.
export const MOTIVOS = Object.freeze({
  PARTE_AUSENTE: 'parte_ausente',                       // 0. estrutura: as 5 partes (ou a resposta do chat) preenchidas
  AVISO_AUSENTE: 'aviso_ausente',                       // 1.
  ESPECIALIDADE_DIVERGENTE: 'especialidade_divergente', // 2.
  TERMO_DIAGNOSTICO: 'termo_diagnostico',               // 3.
  TERMO_PRESCRICAO: 'termo_prescricao',                 // 4.
  TERMO_VEREDITO: 'termo_veredito',                     // 5.
  VALOR_DIVERGENTE: 'valor_divergente',                 // 6.
  CLASSIFICACAO_CONTRADITA: 'classificacao_contradita', // 7.
});

export const PARTES_EXPLICACAO = ['o_que_avalia', 'valor_e_posicao', 'significado', 'especialidade', 'aviso'];

// --- Normalização ------------------------------------------------------------

// "Você TEM   diabetes!" → "voce tem diabetes". Pontuação vira espaço.
export function normalizar(texto) {
  return semAcento(String(texto ?? '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Frases do texto ORIGINAL (antes de tirar a pontuação, que marca o fim da frase).
const frases = (texto) => String(texto ?? '').split(/(?<=[.!?])\s+|\n+/).map(normalizar).filter(Boolean);

// --- Aviso (verificação 1) ------------------------------------------------------
// Confere o SENTIDO (contrato §9), não a cópia exata: "não substitui" +
// avaliação/consulta/diagnóstico + profissional/médico.
function temAviso(fraseNormalizada) {
  return /\bnao substitui\b/.test(fraseNormalizada)
    && /\b(avaliacao|consulta|orientacao|acompanhamento|diagnostico)\b/.test(fraseNormalizada)
    && /\b(profissional|medic[oa]s?)\b/.test(fraseNormalizada);
}

// O trecho do aviso é APAGADO antes de procurar termos proibidos: um aviso como
// "não substitui o diagnóstico de um médico" reprovaria toda resposta correta.
// Só o trecho do aviso sai; o resto da frase continua sendo verificado.
const TRECHO_AVISO = /(\b(esta|essa) (explicacao|resposta|informacao|mensagem) (e )?(apenas )?(informativa )?(e )?)?\bnao substitui\b( \w+){0,8}? (profissional( de saude)?|medic[oa]s?)\b/g;
const tirarAviso = (fraseNormalizada) => fraseNormalizada.replace(TRECHO_AVISO, ' ');

// --- Termos proibidos (verificações 3, 4 e 5) ----------------------------------

const CAMINHO_TERMOS = join(import.meta.dirname, 'termosProibidos.json');

/** Lê e valida a lista de termos. Falha alto se o arquivo estiver malformado. */
export function carregarTermos(caminho = CAMINHO_TERMOS) {
  const dados = JSON.parse(readFileSync(caminho, 'utf8'));
  const compilado = {};
  for (const categoria of ['diagnostico', 'prescricao', 'veredito']) {
    const { termos, negacoes_permitidas: negacoes } = dados[categoria] ?? {};
    if (!Array.isArray(termos) || !Array.isArray(negacoes)) {
      throw new Error(`termosProibidos.json: "${categoria}" precisa de "termos" e "negacoes_permitidas" (listas).`);
    }
    compilado[categoria] = {
      termos: termos.map((t) => ({ termo: t, regex: regexDoTermo(t) })),
      negacoes: negacoes.map((n) => new RegExp(`\\b${n}\\b`, 'g')),
    };
  }
  return compilado;
}

function regexDoTermo(termo) {
  const t = normalizar(termo.replace(/\*$/, ''));
  const final = termo.endsWith('*') ? '[a-z0-9]*' : '';
  return new RegExp(`(?<![a-z0-9])${t}${final}(?![a-z0-9])`);
}

const TERMOS = carregarTermos();
const CODIGO_DA_CATEGORIA = {
  diagnostico: MOTIVOS.TERMO_DIAGNOSTICO, prescricao: MOTIVOS.TERMO_PRESCRICAO, veredito: MOTIVOS.TERMO_VEREDITO,
};

/** Termos proibidos encontrados, por categoria. Exportado para os testes e o doc. */
export function procurarTermos(texto, termos = TERMOS) {
  const limpo = frases(texto).map(tirarAviso).join(' . ');
  const achados = {};
  for (const [categoria, { termos: lista, negacoes }] of Object.entries(termos)) {
    // Negação permitida sai antes ("nao e um diagnostico").
    const semNegacao = negacoes.reduce((t, regex) => t.replace(regex, ' '), limpo);
    const encontrados = lista.filter(({ regex }) => regex.test(semNegacao)).map(({ termo }) => termo);
    if (encontrados.length) achados[categoria] = encontrados;
  }
  return achados;
}

// --- Especialidade (verificação 2) ---------------------------------------------

// Especialidades que, citadas no chat, precisam ser a da base. "Clínico geral" e
// "médico de família" ficam de fora de propósito: indicá-los nunca é errado.
const ESPECIALIDADES = [
  'cardiolog', 'endocrinolog', 'nefrolog', 'hematolog', 'gastroenterolog', 'urolog', 'ginecolog', 'neurolog',
  'pneumolog', 'reumatolog', 'dermatolog', 'oncolog', 'infectolog', 'geriatr', 'pediatr', 'nutrolog', 'hepatolog',
];
const especialidadesCitadas = (texto) => {
  const n = normalizar(texto);
  return ESPECIALIDADES.filter((raiz) => new RegExp(`\\b${raiz}(ia|ista|istas|o|a|os|as)?\\b`).test(n));
};
const raizDaEspecialidade = (nome) => ESPECIALIDADES.find((raiz) => normalizar(nome).startsWith(raiz));

// --- Valor e posição (verificações 6 e 7) --------------------------------------

// "118" → 118; "0,9" → 0.9; "1.234,5" → 1234.5 (mesma convenção do pipeline).
// Dígito colado DEPOIS de uma letra não é número do resultado: é parte da unidade
// ou do nome ("milh/mm3", "/mm3", "B12", "T4"). Sem isso, o "3" de "mm3" reprovava
// toda explicação de hemácias e plaquetas, inclusive a mensagem padrão.
// Cada número vem com as LEITURAS possíveis: "1.010" é mil e dez no padrão
// brasileiro, mas 1,010 na densidade da urina (impressa com ponto decimal).
// Um número confere se alguma leitura for o valor ou um limite da faixa; um
// número inventado não confere em nenhuma.
function numerosDoTexto(texto) {
  return [...String(texto).matchAll(/(?<![\p{L}\d.,])\d+(?:[.,]\d+)*/gu)].map(([n]) => {
    if (n.includes(',')) return [Number(n.replace(/\./g, '').replace(',', '.'))];
    if (/^\d{1,3}(\.\d{3})+$/.test(n)) return [Number(n.replace(/\./g, '')), Number(n)];
    return [Number(n)];
  });
}
const mesmoNumero = (leituras, b) => typeof b === 'number' && leituras.some((a) => Math.abs(a - b) < 1e-9);

const POSICOES = {
  acima: /\b(acima|elevad[oa]s?|alt[oa]s?|aumentad[oa]s?)\b/,
  abaixo: /\b(abaixo|baix[oa]s?|reduzid[oa]s?|diminuid[oa]s?)\b/,
  dentro: /\bdentro\b/,
};
const posicoesCitadas = (texto) => {
  const n = normalizar(texto);
  return Object.keys(POSICOES).filter((p) => POSICOES[p].test(n));
};

// --- Verificações ---------------------------------------------------------------

const preenchido = (v) => typeof v === 'string' && v.trim().length > 0;
const ordenar = (motivos) => Object.values(MOTIVOS).filter((m) => motivos.has(m));

/**
 * Explicação em 5 partes (contrato §4.1).
 * @param {object} resposta objeto com as 5 partes
 * @param {object} analito o analito da sessão (valor, faixa, classificação vêm do PIPELINE)
 * @param {object} ficha ficha da base (especialidade)
 * @returns {{ aprovada: boolean, motivos: string[] }}
 */
export function verificarExplicacao(resposta, analito, ficha) {
  const motivos = new Set();
  const r = resposta && typeof resposta === 'object' ? resposta : {};

  // 0. As 5 partes existem e estão preenchidas. (Ordem: as partes chegam em
  // campos separados, então "ordem" vira "cada campo no seu lugar".)
  if (!PARTES_EXPLICACAO.every((parte) => preenchido(r[parte]))) motivos.add(MOTIVOS.PARTE_AUSENTE);

  // 1. Aviso, na parte 5.
  if (!frases(r.aviso).some(temAviso)) motivos.add(MOTIVOS.AVISO_AUSENTE);

  // 2. Especialidade igual à da base (sem acento/caixa).
  if (normalizar(r.especialidade) !== normalizar(ficha.especialidade)) motivos.add(MOTIVOS.ESPECIALIDADE_DIVERGENTE);

  // 3, 4, 5. Termos proibidos em TODAS as partes (o aviso é apagado antes).
  const todoTexto = PARTES_EXPLICACAO.map((p) => (preenchido(r[p]) ? r[p] : '')).join('\n');
  for (const categoria of Object.keys(procurarTermos(todoTexto))) motivos.add(CODIGO_DA_CATEGORIA[categoria]);

  // 6. Valor: a parte 2 cita o valor do pipeline, e todo número dela é o valor
  // ou um limite da faixa (o modelo não pode inventar nem arredondar número).
  const permitidos = [analito.valor, analito.faixa_referencia?.minimo, analito.faixa_referencia?.maximo];
  const numeros = numerosDoTexto(r.valor_e_posicao ?? '');
  if (!numeros.some((n) => mesmoNumero(n, analito.valor)) || !numeros.every((n) => permitidos.some((p) => mesmoNumero(n, p)))) {
    motivos.add(MOTIVOS.VALOR_DIVERGENTE);
  }

  // 7. Posição: a parte 2 diz a posição do pipeline, e só ela.
  const posicoes = posicoesCitadas(r.valor_e_posicao ?? '');
  if (posicoes.length !== 1 || posicoes[0] !== analito.classificacao) motivos.add(MOTIVOS.CLASSIFICACAO_CONTRADITA);

  return { aprovada: motivos.size === 0, motivos: ordenar(motivos) };
}

/**
 * Resposta do chat (contrato §4.2): texto livre.
 * @param {{ resposta: string }} resposta
 * @param {object} ficha ficha da base (para a especialidade, se citada)
 * @returns {{ aprovada: boolean, motivos: string[] }}
 */
export function verificarChat(resposta, ficha) {
  const motivos = new Set();
  const texto = resposta && typeof resposta === 'object' ? resposta.resposta : undefined;
  if (!preenchido(texto)) motivos.add(MOTIVOS.PARTE_AUSENTE);

  // 1. Aviso no FIM: uma das duas últimas frases.
  if (!frases(texto).slice(-2).some(temAviso)) motivos.add(MOTIVOS.AVISO_AUSENTE);

  // 2. Se citar especialidade, só a da base.
  const daBase = raizDaEspecialidade(ficha.especialidade);
  if (especialidadesCitadas(texto ?? '').some((raiz) => raiz !== daBase)) motivos.add(MOTIVOS.ESPECIALIDADE_DIVERGENTE);

  // 3, 4, 5.
  for (const categoria of Object.keys(procurarTermos(texto ?? ''))) motivos.add(CODIGO_DA_CATEGORIA[categoria]);

  return { aprovada: motivos.size === 0, motivos: ordenar(motivos) };
}
