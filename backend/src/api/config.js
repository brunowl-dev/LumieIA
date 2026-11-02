// Configuração do orquestrador: o ÚNICO lugar da pasta api/ que lê o ambiente
// (.env.example). As funções recebem estes valores por parâmetro, então os
// testes passam outros sem mexer no ambiente.
import { join } from 'node:path';

const RAIZ_DO_REPOSITORIO = join(import.meta.dirname, '..', '..', '..');

// Valor inválido é erro de configuração: falhar alto na subida do servidor.
function lerNumero(nome, padrao, minimo, maximo) {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === '') return padrao;
  const valor = Number(bruto);
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new Error(`Variável ${nome}="${bruto}" inválida: use um número de ${minimo} a ${maximo}.`);
  }
  return valor;
}

export const PORTA = lerNumero('BACKEND_PORT', 3001, 1, 65535);

// Quantas vezes pedir NOVA resposta depois de uma reprovação. 2 → até 3
// tentativas. Motivo do número: docs/seguranca-verificacoes.md.
export const MAX_REGENERACOES = lerNumero('MAX_REGENERACOES', 2, 0, 5);

// Sessão em memória (laudo, identificadores, mapa, chat): some depois disso sem uso.
export const SESSION_TTL_MINUTES = lerNumero('SESSION_TTL_MINUTES', 30, 1, 24 * 60);

export const UPLOAD_MAX_MB = lerNumero('UPLOAD_MAX_MB', 10, 1, 19);

// Tempo máximo de UMA chamada ao modelo. Estourou → MODELO_INDISPONIVEL.
export const OLLAMA_TIMEOUT_MS = lerNumero('OLLAMA_TIMEOUT_MS', 60000, 1000, 300000);

export const CAMINHO_BASE_CONHECIMENTO = process.env.KNOWLEDGE_BASE_PATH
  || join(RAIZ_DO_REPOSITORIO, 'docs', 'base-conhecimento', 'exames.json');
