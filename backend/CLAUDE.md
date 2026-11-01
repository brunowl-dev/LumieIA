# CLAUDE.md — backend (Node.js)

Leia antes: `../CLAUDE.md` (raiz) e `../docs/contrato.md`.

## Estrutura
- `src/api/` — rotas HTTP e orquestrador (envio do laudo → pipeline; explicação e chat → IA → segurança, com o laço de regeneração). Dono: Bruno (BWL).
- `src/pipeline/` — extração, estruturação, classificação por regras. Dono: Bruno (BWL).
- `src/seguranca/` — validação da resposta do modelo. Dono: Bruno (BWL).
- `src/ia/` — cliente do modelo, prompt, busca na base (RAG), chat. Dono: Isadora (ISA).

## Regras do backend
- Um único projeto Node, módulos separados por pasta. Um módulo NÃO importa o interior de outro: conversam só pelo formato definido em `docs/contrato.md`.
- Cada módulo exporta poucas funções públicas, com entrada e saída iguais ao contrato.
- Cada módulo deve poder ser testado SOZINHO, usando os JSONs de `samples/`.
- Configuração só por variáveis de ambiente (`.env.example`). Nada de chave ou URL fixa no código.
- O backend roda em Docker. Escute em `0.0.0.0` dentro do container e use a porta de `BACKEND_PORT`.
- Rota de saúde (`GET /api/saude`) para o healthcheck do Docker. Ponto de entrada: `src/server.js`.
- Dependências com `npm install` e `package-lock.json` commitado (o Docker usa `npm ci --omit=dev`).
- Idiomas do OCR já vêm na imagem em `TESSDATA_PATH`; uploads temporários em `UPLOAD_DIR` (tmpfs). Detalhes em `../docs/docker.md`.
- Sem banco de dados no protótipo: o laudo estruturado da sessão fica em memória, com expiração (`SESSION_TTL_MINUTES`).
- Nunca registrar (log) texto bruto de laudo nem dados que identifiquem o paciente.
