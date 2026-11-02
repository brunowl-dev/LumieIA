// Etapa 5 do pipeline (BWL-05): classificação por regra determinística.
// - dentro / acima / abaixo: SEMPRE pela faixa de referência impressa no laudo.
// - alerta crítico: pelos limites de limitesCriticos.json, cada um com fonte.
// Funções puras: recebem tudo por parâmetro, não leem arquivo, não usam o
// modelo, não gravam log. O modelo de linguagem nunca passa por aqui.
import { readFileSync } from 'node:fs';

/**
 * Compara o valor com a faixa do laudo. Regras de fronteira (sentido literal
 * do texto impresso, ver backend/src/pipeline/CLAUDE.md):
 * - limite inclusivo ("70 a 99", "Até 150"): o próprio limite está dentro;
 * - limite exclusivo ("Inferior a 190", "Superior a 40"): o próprio limite está fora.
 * @param {number} valor
 * @param {{ minimo: number|null, maximo: number|null,
 *   minimo_inclusivo: boolean|null, maximo_inclusivo: boolean|null,
 *   interpretada?: boolean }} faixa
 * @returns {{ classificacao: 'dentro'|'acima'|'abaixo'|null, motivo: string|null }}
 *   classificacao null (com motivo) quando não dá para classificar sem chutar.
 */
export function classificarPelaFaixa(valor, faixa) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return { classificacao: null, motivo: 'valor_invalido' };
  }
  const temMinimo = typeof faixa?.minimo === 'number';
  const temMaximo = typeof faixa?.maximo === 'number';
  if (faixa?.interpretada === false || (!temMinimo && !temMaximo)) {
    return { classificacao: null, motivo: 'faixa_nao_interpretada' };
  }

  if (temMinimo) {
    // Inclusivo: abaixo só se for MENOR que o mínimo. Exclusivo: igual também é abaixo.
    const abaixo = faixa.minimo_inclusivo === false ? valor <= faixa.minimo : valor < faixa.minimo;
    if (abaixo) return { classificacao: 'abaixo', motivo: null };
  }
  if (temMaximo) {
    const acima = faixa.maximo_inclusivo === false ? valor >= faixa.maximo : valor > faixa.maximo;
    if (acima) return { classificacao: 'acima', motivo: null };
  }
  return { classificacao: 'dentro', motivo: null };
}

/**
 * Forma comparável da unidade: sem espaços, minúsculas, e os três jeitos de
 * escrever "micro" (µ U+00B5 do PDF, μ U+03BC do OCR, "u" digitado) iguais.
 * "mg/dL" = "mg/dl"; "µUI/mL" = "μUI/mL" = "uUI/mL".
 * @param {string|null} unidade
 * @returns {string|null}
 */
export function normalizarUnidade(unidade) {
  if (typeof unidade !== 'string' || unidade.trim() === '') return null;
  return unidade.replace(/\s+/g, '').toLowerCase().replace(/[µμ]/g, 'u');
}

/**
 * A unidade lida é uma das esperadas para o exame?
 * @returns {boolean|null} null quando não há o que comparar (exame sem
 *   configuração ou unidade ausente)
 */
export function unidadeCompativel(unidade, unidadesAceitas) {
  const lida = normalizarUnidade(unidade);
  if (lida === null || !Array.isArray(unidadesAceitas) || unidadesAceitas.length === 0) return null;
  return unidadesAceitas.some((aceita) => normalizarUnidade(aceita) === lida);
}

const ehNumeroOuNulo = (x) => x === null || (typeof x === 'number' && Number.isFinite(x));

/**
 * Confere o arquivo de limites críticos. Falha alto se algo estiver errado:
 * limite sem fonte, fonte que não existe, número inválido, exame sem limite
 * e sem explicação do porquê.
 * @param {object} config conteúdo de limitesCriticos.json
 * @returns {object} o mesmo config, já validado
 */
export function validarLimitesCriticos(config) {
  if (!config || typeof config.analitos !== 'object' || typeof config.fontes !== 'object') {
    throw new Error('limitesCriticos.json malformado: faltam "fontes" ou "analitos".');
  }
  for (const [id, item] of Object.entries(config.analitos)) {
    if (!Array.isArray(item.unidades_aceitas)) {
      throw new Error(`limitesCriticos.json: "${id}" sem a lista unidades_aceitas.`);
    }
    const limite = item.limite_critico;
    if (limite === null) {
      if (typeof item.sem_limite_critico?.motivo !== 'string' || item.sem_limite_critico.motivo === '') {
        throw new Error(`limitesCriticos.json: "${id}" não tem limite crítico e não explica o porquê (sem_limite_critico.motivo).`);
      }
      continue;
    }
    if (!ehNumeroOuNulo(limite?.abaixo_de) || !ehNumeroOuNulo(limite?.acima_de)
      || (limite.abaixo_de === null && limite.acima_de === null)) {
      throw new Error(`limitesCriticos.json: "${id}" precisa de abaixo_de e/ou acima_de numéricos.`);
    }
    if (limite.abaixo_de !== null && limite.acima_de !== null && limite.abaixo_de >= limite.acima_de) {
      throw new Error(`limitesCriticos.json: "${id}" tem abaixo_de maior ou igual a acima_de.`);
    }
    if (typeof limite.unidade !== 'string' || limite.unidade === '') {
      throw new Error(`limitesCriticos.json: "${id}" sem a unidade do limite.`);
    }
    if (limite.fonte !== 'fonte_pendente' && !config.fontes[limite.fonte]) {
      throw new Error(`limitesCriticos.json: "${id}" cita a fonte "${limite.fonte}", que não está em "fontes".`);
    }
  }
  return config;
}

/** Lê e valida limitesCriticos.json. */
export function carregarLimitesCriticos(caminho) {
  return validarLimitesCriticos(JSON.parse(readFileSync(caminho, 'utf8')));
}

/**
 * Decide o alerta crítico de um analito. Só há alerta quando há um limite com
 * fonte, a unidade lida é a do limite e o valor passa do limite.
 * @param {{ id_canonico: string|null, valor: number, unidade: string|null }} analito
 * @param {object} config limites validados
 * @returns {{ alerta_critico: boolean, limite_critico: {
 *   avaliado: boolean, motivo: string|null, acionado: 'abaixo_de'|'acima_de'|null,
 *   abaixo_de: number|null, acima_de: number|null, unidade: string|null,
 *   fonte: { id: string, referencia: string, url: string, trecho_da_fonte: string }|null } }}
 *   motivo (quando avaliado é false): exame_nao_reconhecido, sem_limite_definido,
 *   fonte_pendente, unidade_diferente, valor_invalido.
 */
export function avaliarLimiteCritico({ id_canonico: id, valor, unidade }, config) {
  const naoAvaliado = (motivo, limite = null, fonte = null) => ({
    alerta_critico: false,
    limite_critico: {
      avaliado: false,
      motivo,
      acionado: null,
      abaixo_de: limite?.abaixo_de ?? null,
      acima_de: limite?.acima_de ?? null,
      unidade: limite?.unidade ?? null,
      fonte,
    },
  });

  if (id === null || id === undefined) return naoAvaliado('exame_nao_reconhecido');
  const limite = config.analitos[id]?.limite_critico ?? null;
  if (limite === null) return naoAvaliado('sem_limite_definido');
  // Regra do pipeline: limite sem fonte citável não entra.
  if (limite.fonte === 'fonte_pendente') return naoAvaliado('fonte_pendente', limite);

  const fonte = {
    id: limite.fonte,
    referencia: config.fontes[limite.fonte].referencia,
    url: config.fontes[limite.fonte].url,
    trecho_da_fonte: limite.trecho_da_fonte ?? null,
  };
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return naoAvaliado('valor_invalido', limite, fonte);
  // Não convertemos unidades (ex.: mmol/L → mg/dL): um fator errado esconderia
  // ou inventaria um alerta. Unidade diferente = limite não avaliado.
  if (normalizarUnidade(unidade) !== normalizarUnidade(limite.unidade)) {
    return naoAvaliado('unidade_diferente', limite, fonte);
  }

  let acionado = null;
  if (limite.abaixo_de !== null && valor < limite.abaixo_de) acionado = 'abaixo_de';
  else if (limite.acima_de !== null && valor > limite.acima_de) acionado = 'acima_de';

  return {
    alerta_critico: acionado !== null,
    limite_critico: {
      avaliado: true,
      motivo: null,
      acionado,
      abaixo_de: limite.abaixo_de,
      acima_de: limite.acima_de,
      unidade: limite.unidade,
      fonte,
    },
  };
}

/**
 * Classificação completa de um analito: faixa do laudo + limite crítico.
 * @param {{ id_canonico: string|null, valor: number, unidade: string|null,
 *   faixa_referencia: object }} analito
 * @param {object} config limites validados
 */
export function classificarAnalito(analito, config) {
  const { classificacao, motivo } = classificarPelaFaixa(analito.valor, analito.faixa_referencia);
  return {
    classificacao,
    motivo_sem_classificacao: motivo,
    ...avaliarLimiteCritico(analito, config),
  };
}
