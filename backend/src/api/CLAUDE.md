# CLAUDE.md — backend/src/api (Bruno — BWL)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seções "Portas HTTP" e "Erros").

## Escopo desta pasta
- Rotas HTTP do contrato (enviar laudo, chat, lembretes P2, saúde).
- **Orquestrador:** recebe o arquivo → pipeline → (para cada analito) IA → segurança → monta o cartão. É o único lugar que chama os três módulos.

## Regras
- Sem regra de negócio aqui: classificação fica no pipeline, validação na segurança, texto na IA. Esta pasta só liga as peças e traduz erros para o formato do contrato.
- Validar o upload: tipo (PDF/imagem), tamanho (`UPLOAD_MAX_MB`). Não guardar o arquivo em disco além do necessário; apagar após o processamento.
- Sessão em memória: guardar o laudo estruturado por `id_laudo`, com expiração (`SESSION_TTL_MINUTES`), para o chat. Sem banco.
- Erros sempre no formato do contrato, com mensagem em linguagem simples para o paciente.
- CORS liberado só para `CORS_ORIGIN`.
- Se o modelo estiver indisponível/lento (`OLLAMA_TIMEOUT_MS`), devolver `MODELO_INDISPONIVEL` — ou a mensagem padrão, se o grupo decidir assim (decisão em aberto no contrato).

## Modo de trabalho (Bruno)
Modo GUIADO, como em `../pipeline/CLAUDE.md`. Explique o que é rota, middleware, upload multipart e orquestração antes de implementar.
