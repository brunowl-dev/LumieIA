// Ponto de entrada do backend: monta as peças e sobe o servidor.
// As rotas e a orquestração ficam em src/api/rotas.js; aqui só se escolhe O QUE
// é ligado a quê, lendo a configuração do ambiente (src/api/config.js).
//
// IA: por enquanto a IA FALSA (src/api/iaFalsa.js). Quando o código da Isadora
// chegar, troca-se só o `cliente` abaixo; o adaptador continua igual.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMINHO_BASE_CONHECIMENTO, MAX_REGENERACOES, OLLAMA_TIMEOUT_MS, PORTA, SESSION_TTL_MINUTES, UPLOAD_MAX_MB,
} from './api/config.js';
import { carregarFichas, criarApp } from './api/rotas.js';
import { criarSessoes } from './api/sessao.js';
import { criarAdaptadorIa } from './api/adaptadorIa.js';
import { criarIaFalsa } from './api/iaFalsa.js';
import { carregarDadosDoPipeline } from './pipeline/processarLaudo.js';
import { registrarEvento } from './seguranca/registrarEvento.js';

// 0.0.0.0 = aceitar conexões de fora do container (localhost só aceitaria de dentro)
const HOST = '0.0.0.0';

// Base e limites críticos são lidos JÁ na subida: arquivo malformado derruba o
// servidor com mensagem clara, em vez de falhar no 1º laudo enviado.
carregarDadosDoPipeline();
const fichas = carregarFichas(CAMINHO_BASE_CONHECIMENTO);

const sessoes = criarSessoes({ ttlMs: SESSION_TTL_MINUTES * 60_000 });
sessoes.iniciarLimpezaPeriodica();

const adaptador = criarAdaptadorIa({ cliente: criarIaFalsa(), timeoutMs: OLLAMA_TIMEOUT_MS });

const app = criarApp({ sessoes, adaptador, fichas, maxRegeneracoes: MAX_REGENERACOES, uploadMaxMb: UPLOAD_MAX_MB });

createServer(app).listen(PORTA, HOST, () => {
  registrarEvento('SERVIDOR_INICIADO', { porta: PORTA });
  console.log(`Lumie backend ouvindo em http://${HOST}:${PORTA} (IA FALSA: o modelo ainda não está ligado)`);

  // Confere se os dados de idioma do OCR vieram dentro da imagem (ver Dockerfile).
  const tessdata = process.env.TESSDATA_PATH;
  if (tessdata) {
    for (const idioma of ['por', 'eng']) {
      const arquivo = join(tessdata, `${idioma}.traineddata.gz`);
      console.log(`OCR ${idioma}: ${existsSync(arquivo) ? 'encontrado' : 'AUSENTE'} (${arquivo})`);
    }
  }
});
