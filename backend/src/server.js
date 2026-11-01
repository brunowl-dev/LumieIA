// Esqueleto mínimo do backend do Lumie: só existe para o Docker subir e o
// healthcheck funcionar. As rotas do contrato (POST /api/laudos, /api/chat)
// entram depois, em src/api/, e este arquivo passa a só iniciar o servidor.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.BACKEND_PORT) || 3001;
// 0.0.0.0 = aceitar conexões de fora do container (localhost só aceitaria de dentro)
const HOST = '0.0.0.0';

function responderJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/saude') {
    return responderJson(res, 200, { status: 'ok' });
  }
  if (req.method === 'GET' && req.url === '/api') {
    return responderJson(res, 200, { projeto: 'Lumie', modulo: 'IA', versao: '0.1.0' });
  }
  return responderJson(res, 404, {
    status: 'erro',
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem_usuario: 'Endereço não encontrado.' },
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Lumie backend ouvindo em http://${HOST}:${PORT}`);

  // Confere se os dados de idioma do OCR vieram dentro da imagem (ver Dockerfile).
  const tessdata = process.env.TESSDATA_PATH;
  if (tessdata) {
    for (const idioma of ['por', 'eng']) {
      const arquivo = join(tessdata, `${idioma}.traineddata.gz`);
      console.log(`OCR ${idioma}: ${existsSync(arquivo) ? 'encontrado' : 'AUSENTE'} (${arquivo})`);
    }
  }
});
