// PROMPTS VERSIONADOS (ISA-02, contrato §4.5).
// Os textos ficam em ./prompts/<versão>/<nome>.md, separados do código, para que
// mudar o prompt não exija mexer na lógica. Nova versão = nova pasta (v2/),
// sem apagar a anterior; a versão em uso é a constante abaixo.

import { readFileSync } from 'node:fs';

export const VERSAO_PROMPT = 'v1';

// Só estes nomes existem: evita montar um caminho de arquivo com texto arbitrário.
const NOMES = ['explicacao', 'chat'];

/**
 * @param {'explicacao' | 'chat'} nome
 * @returns {string} o texto do prompt da versão em uso
 */
export function carregarPrompt(nome) {
  if (!NOMES.includes(nome)) throw new Error(`Prompt desconhecido: ${nome}`);
  // Caminho relativo a ESTE arquivo (não à pasta de onde o node foi iniciado).
  return readFileSync(new URL(`./prompts/${VERSAO_PROMPT}/${nome}.md`, import.meta.url), 'utf8');
}
