# CLAUDE.md — backend/src/ia (Isadora — ISA)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seções "Pipeline → IA", "Base de conhecimento" e "IA → Segurança").

## Escopo desta pasta
- Cliente do modelo (Ollama Cloud, `gpt-oss`), configurado por variáveis de ambiente (`OLLAMA_*`).
- Prompt de instruções (versionado em `prompts/`, ex.: `v1`, `v2`) com as 5 partes na ordem fixa.
- Busca na base de conhecimento (RAG): a partir do `id_canonico` do analito, localizar a ficha em `exames.json` e injetá-la no prompt.
- Chat sobre o exame da sessão.
- Reaproveitar a regeneração quando a camada de segurança reprovar.
- (P2) redação do tom do lembrete — horários e doses nunca vêm do modelo.

## Regras
- O modelo recebe SOMENTE dados estruturados e pseudonimizados + conteúdo da base. Nunca o texto bruto do laudo.
- O modelo NÃO decide classificação nem alerta: recebe isso pronto do pipeline e apenas explica.
- Se o conhecimento do modelo divergir da base, **a base prevalece** (diga isso no prompt).
- Proibido no texto gerado: diagnóstico, indicação/ajuste de medicamento, veredito de tranquilidade ou preocupação, a palavra "preocupante". Use "merece atenção".
- A resposta de cada analito sai com as 5 partes em campos separados (formato do contrato). Como obter isso do modelo (ex.: pedir JSON) é decisão sua; documente o prompt e cada versão — vira material do artigo/apresentação.
- Chat: responde só sobre o exame da sessão (laudo estruturado + base), sem memória entre sessões, e passa pela mesma camada de segurança.
- Tratar timeout e indisponibilidade do modelo: devolver erro tipado, nunca travar a requisição.
- Confirmar logo: o modelo escolhido está disponível na sua conta do Ollama Cloud e dentro do limite gratuito? (Os limites do plano gratuito não foram verificados.)
- Para testar sem o pipeline, use os JSONs de `../../../samples/`.

## Modo de trabalho
[PREENCHER pela Isadora: como você quer trabalhar com o Claude Code nesta pasta — por exemplo, "guiado: explique e eu escrevo" ou "pode gerar com explicação". Enquanto isso, vale o padrão da raiz: explicar antes, passos pequenos, testar cada etapa isolada.]
