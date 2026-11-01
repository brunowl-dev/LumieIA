# Docker — como rodar o Lumie

**Estado atual:** o `docker-compose.yml` e os Dockerfiles do front e do back **ainda não existem** (tarefa GRP-05 na `tasklist.md`). Eles só podem ser criados e testados quando cada serviço tiver o seu `package.json`. Este arquivo descreve o que eles precisam respeitar.

## Passo a passo (quando o compose existir)
1. `cp .env.example .env`
2. Crie uma chave em https://ollama.com/settings/keys e cole em `OLLAMA_API_KEY` no `.env`.
3. `docker compose up --build`
4. Front em `http://localhost:3000` e API em `http://localhost:3001` (portas do `.env`).

## O que o compose precisa respeitar
- Dois serviços: `frontend` e `backend`. **Sem container do Ollama:** o modelo roda na nuvem (`OLLAMA_BASE_URL=https://ollama.com`).
- Ambos leem o `.env` da raiz. O `.env` nunca vai para o Git.
- O `backend` monta `./docs/base-conhecimento` em `/app/knowledge` (somente leitura), para bater com `KNOWLEDGE_BASE_PATH`.
- Healthcheck do `backend` em `GET /api/saude`.
- Dentro da rede do Docker os serviços se chamam pelo nome (`backend`). O NAVEGADOR, porém, acessa a API pelo `localhost` do seu computador (por isso `VITE_API_URL` usa `localhost`).
- O backend escuta em `0.0.0.0`.

## Pontos de atenção
- **Internet na apresentação:** o modelo é na nuvem, então a demo precisa de rede. Plano B: vídeo gravado (GRP-04).
- **OCR:** o `tesseract.js` baixa o idioma `por` na primeira execução; deixe o arquivo de idioma local para não depender da rede.
- **Limites do plano gratuito do Ollama Cloud:** não foram verificados. Teste a taxa de uso antes de ensaiar a demo (ISA-01).
- Modelos: `gpt-oss:120b` (padrão do `.env.example`) ou `gpt-oss:20b` (mais leve).
