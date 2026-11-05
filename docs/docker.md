# Docker — como o Lumie roda

Passo a passo para rodar e erros comuns: seção "Como rodar com Docker" do `README.md`. Este arquivo explica **como está montado** e as regras que o código precisa respeitar.

## Arquivos
| Arquivo | Papel |
|---|---|
| `docker-compose.yml` | Sobe os dois serviços, rede interna, healthcheck, volumes |
| `backend/Dockerfile` | Node 24 Alpine, só dependências de produção, usuário `node` (não-root), idiomas do OCR embutidos |
| `frontend/Dockerfile` | Multi-stage: Node compila o React (Vite) → nginx serve os estáticos |
| `frontend/nginx.conf.template` | Serve o front e faz o proxy de `/api/` para o backend |
| `.env.example` | Todas as variáveis; copie para `.env` |
| `*/.dockerignore` | O que não entra na imagem (`node_modules`, `.env`, `.git`...) |

## Como as peças conversam
```
Navegador ──> localhost:FRONTEND_PORT ──> nginx (frontend)
                                            ├─ /        → arquivos do React
                                            └─ /api/... → http://backend:BACKEND_PORT  (rede interna "lumie")
```
- **Proxy, sem CORS:** o front chama sempre caminhos relativos (`fetch('/api/laudos')`). Para o navegador, front e API têm a mesma origem, então não há CORS e não há URL da API embutida no build.
- O backend também é publicado em `localhost:BACKEND_PORT`, só para teste com `curl`.
- Sem `npm run dev` no Docker: fora do Docker, o `vite.config.js` faz o mesmo proxy para `http://localhost:3001`.

## Regras que o código precisa respeitar
- **Backend:** escutar em `0.0.0.0` na porta `BACKEND_PORT`; manter `GET /api/saude` → `{"status":"ok"}` (healthcheck); ponto de entrada `src/server.js`.
- **Dependências:** instale com `npm install <pacote>` (na pasta do serviço) e commite o `package-lock.json`. Os Dockerfiles usam `npm ci`, que falha se o lock estiver faltando ou desatualizado.
- **Front:** nunca usar `http://localhost:3001` no código; só `/api/...`.
- **Base de conhecimento:** montada em `/app/knowledge` (somente leitura) → `KNOWLEDGE_BASE_PATH`.
- **Upload:** limite do nginx é 20 MB (`client_max_body_size`); `UPLOAD_MAX_MB` precisa ficar abaixo disso, para o erro `ARQUIVO_MUITO_GRANDE` sair do backend no formato do contrato.
- **Tempo de resposta:** o nginx espera até 300 s (`proxy_read_timeout`) por causa das chamadas ao modelo e das regenerações.

## OCR sem internet na hora da demo
A imagem do backend já vem com `por.traineddata.gz` e `eng.traineddata.gz` em `/app/tessdata` (variável `TESSDATA_PATH`), baixados no **build**. No código do OCR, aponte o Tesseract.js para essa pasta e desligue o cache em disco (o usuário `node` não pode gravar em `/app`). Exemplo (conferir os nomes das opções na versão instalada):
```js
const worker = await createWorker(process.env.OCR_LANG.split('+'), 1, {
  langPath: process.env.TESSDATA_PATH,
  cacheMethod: 'none',
});
```
O log de inicialização do backend mostra `OCR por: encontrado` / `OCR eng: encontrado`.
**Consequência:** faça o `docker compose up --build` com internet **antes** da apresentação. No dia, rode só `docker compose up` (sem `--build`), que usa a imagem pronta.

## Uploads e LGPD
- `/app/uploads` é um **tmpfs** (memória RAM, 50 MB): nada vai para o disco e tudo some quando o container para.
- Mesmo assim, o código deve **apagar o arquivo logo após extrair o texto** (`backend/src/api/CLAUDE.md`). Melhor ainda: processar o upload em memória (Buffer), sem gravar arquivo nenhum.
- Na sessão em memória ficam o laudo estruturado, o histórico do chat (já pseudonimizado) e, só como lista do que apagar do chat, os identificadores do cabeçalho com o mapa de substituição. Tudo some com a expiração (`SESSION_TTL_MINUTES`) e nada disso vai para disco, IA, front ou log (`docs/pseudonimizacao.md`).

## Pontos de atenção
- **Internet na apresentação:** o modelo é na nuvem, então a demo precisa de rede. Plano B: vídeo gravado (GRP-04).
- **Limites do plano gratuito do Ollama Cloud:** não foram verificados. Teste a taxa de uso antes de ensaiar a demo (ISA-01).
- Modelo: `beam` (padrão do `.env.example`). Os `gpt-oss` dão HTTP 402 na conta gratuita (`docs/ia-resultados.md`).
