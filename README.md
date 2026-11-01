# Lumie — módulo de IA

Módulo de IA do Lumie (hub de saúde digital): interpreta exames laboratoriais em linguagem simples, indica a especialidade médica associada e (se sobrar tempo) gera lembretes de medicação, **sem diagnosticar**. Protótipo do artigo apresentado no COBRIC (Santos), 05/11/2026.

Autores: Bruno Antonio Wai Lu, Isadora Oliveira da Silva e Maria Eduarda Aguiar Duarte — Fatec Rubens Lara (ADS).

## Estrutura
```
frontend/                      React (Aguiar)
backend/src/api/               rotas + orquestrador (Bruno)
backend/src/pipeline/          extração, estruturação, classificação (Bruno)
backend/src/seguranca/         camada de segurança (Bruno)
backend/src/ia/                modelo, prompt, RAG, chat (Isadora)
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
4. Rodar com Docker: veja `docs/docker.md` (o `docker-compose.yml` ainda será criado — tarefa GRP-05).

## Regras de ouro
- A IA não diagnostica, não indica medicamento e não dá veredito.
- A classificação dos valores é por regras determinísticas, nunca pelo modelo.
- Só dados sintéticos (LGPD).
