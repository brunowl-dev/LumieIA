// Ponto de entrada do backend: monta as peças e sobe o servidor.
// As rotas e a orquestração ficam em src/api/rotas.js; aqui só se escolhe O QUE
// é ligado a quê, lendo a configuração do ambiente (src/api/config.js).
//
// IA: IA_FALSA=true (padrão) usa a IA falsa (src/api/iaFalsa.js); IA_FALSA=false
// usa o modelo real (src/ia/index.js). Só o `cliente` muda; o adaptador é o mesmo.
import { createServer } from 'node:http';
import {
  CAMINHO_BASE_CONHECIMENTO, IA_FALSA, MAX_REGENERACOES, OLLAMA_TIMEOUT_MS, PORTA, SESSION_TTL_MINUTES, UPLOAD_MAX_MB,
} from './api/config.js';
import { carregarFichas, criarApp } from './api/rotas.js';
import { criarSessoes } from './api/sessao.js';
import { criarAdaptadorIa } from './api/adaptadorIa.js';
import { criarIaFalsa } from './api/iaFalsa.js';
import { criarClienteIa } from './ia/index.js';
import { carregarDadosDoPipeline } from './pipeline/processarLaudo.js';
import { aquecerOcr } from './pipeline/extrairTextoImagem.js';
import { registrarEvento } from './seguranca/registrarEvento.js';

// 0.0.0.0 = aceitar conexões de fora do container (localhost só aceitaria de dentro)
const HOST = '0.0.0.0';

// Base e limites críticos são lidos JÁ na subida: arquivo malformado derruba o
// servidor com mensagem clara, em vez de falhar no 1º laudo enviado.
carregarDadosDoPipeline();
const fichas = carregarFichas(CAMINHO_BASE_CONHECIMENTO);

const sessoes = criarSessoes({ ttlMs: SESSION_TTL_MINUTES * 60_000 });
sessoes.iniciarLimpezaPeriodica();

const cliente = IA_FALSA ? criarIaFalsa() : criarClienteIa();
const adaptador = criarAdaptadorIa({ cliente, timeoutMs: OLLAMA_TIMEOUT_MS });

const app = criarApp({ sessoes, adaptador, fichas, maxRegeneracoes: MAX_REGENERACOES, uploadMaxMb: UPLOAD_MAX_MB });

createServer(app).listen(PORTA, HOST, () => {
  registrarEvento('SERVIDOR_INICIADO', { porta: PORTA });
  const ia = IA_FALSA ? 'IA FALSA: o modelo não está ligado (IA_FALSA=false liga)' : 'IA real: Ollama Cloud';
  console.log(`Lumie backend ouvindo em http://${HOST}:${PORTA} (${ia})`);

  // OCR (BWL-10): cria o worker já na subida, para a 1ª foto não esperar e para
  // um arquivo de idioma ausente aparecer aqui, e não no meio da demo. Se falhar,
  // o servidor continua (PDF digital funciona); a próxima foto tenta de novo.
  aquecerOcr().then(
    () => console.log('OCR pronto'),
    (erro) => console.error(`OCR indisponível: ${erro.message}`),
  );
});
