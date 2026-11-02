# Lumie — módulo de IA

Módulo de IA do Lumie (hub de saúde digital): interpreta exames laboratoriais em linguagem simples, indica a especialidade médica associada e (se sobrar tempo) gera lembretes de medicação, **sem diagnosticar**. Protótipo do artigo apresentado no COBRIC (Santos), 05/11/2026.

Autores: Bruno Antonio Wai Lu, Isadora Oliveira da Silva e Maria Eduarda Aguiar Duarte — Fatec Rubens Lara (ADS).

## Estrutura
```
frontend/                      React (Aguiar)
backend/src/api/               rotas + orquestrador (Bruno)
backend/src/pipeline/          extração, estruturação, classificação (Bruno)
backend/src/seguranca/         camada de segurança (Bruno)
backend/src/ia/                modelo, prompts, chat (Isadora)
docs/contrato.md               formato dos dados entre as partes
docs/tasklist.md               tarefas e requisitos por pessoa
docs/artigo-vs-prototipo.md    onde o protótipo difere do artigo
docs/docker.md                 como rodar com Docker
docs/base-conhecimento/        fichas dos exames (Aguiar)
samples/                       laudos e dados sintéticos
```

## Por onde começar
1. Leia `CLAUDE.md` (raiz), o `CLAUDE.md` da sua pasta e `docs/contrato.md`.
2. Veja suas tarefas em `docs/tasklist.md`.
3. `cp .env.example .env` e preencha `OLLAMA_API_KEY` (o `.env` nunca vai para o Git).
4. Rodar com Docker: seção abaixo (detalhes técnicos em `docs/docker.md`).

## Como rodar com Docker

### Pré-requisitos
- Docker Desktop (Windows/macOS) ou Docker Engine + plugin Compose (Linux), aberto e rodando. Confira com `docker compose version`.
- Internet: o modelo de linguagem roda na nuvem (Ollama Cloud). O **primeiro build** também precisa de rede (baixa imagens base, dependências e os idiomas do OCR).
- Uma chave do Ollama Cloud: https://ollama.com/settings/keys

### Passo a passo
```bash
cp .env.example .env          # no PowerShell: Copy-Item .env.example .env
# abra o .env e cole sua chave em OLLAMA_API_KEY
docker compose up --build
```
Para parar: `Ctrl+C` e depois `docker compose down`.

### Como conferir se subiu
1. `docker compose ps` → `backend` com status `healthy` e `frontend` `running`.
2. `curl http://localhost:3001/api/saude` → `{"status":"ok"}` (backend direto).
3. `curl http://localhost:3000/api/saude` → `{"status":"ok"}` (passando pelo proxy do nginx).
4. Navegador em http://localhost:3000 → página "Lumie" com **Backend: conectado**.
5. `docker compose logs backend` → `OCR por: encontrado` e `OCR eng: encontrado`.

### Erros mais prováveis
| Erro | Causa | Solução |
|---|---|---|
| `env file ... .env not found` | O `.env` não foi criado | `cp .env.example .env` na raiz do repositório |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Outro programa (ex.: um `npm run dev`) já usa a porta | Feche o programa ou troque `FRONTEND_PORT`/`BACKEND_PORT` no `.env` |
| `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` (ou `error during connect`) | O Docker Desktop está fechado ou ainda iniciando | Abra o Docker Desktop, espere "Engine running" e confira com `docker info` |
| `dependency failed to start: container lumie-backend-1 is unhealthy` | O backend não respondeu ao healthcheck | Veja `docker compose logs backend` para o erro do backend |

## Regras de ouro
- A IA não diagnostica, não indica medicamento e não dá veredito.
- A classificação dos valores é por regras determinísticas, nunca pelo modelo.
- Só dados sintéticos (LGPD).
