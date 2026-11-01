# CLAUDE.md — backend/src/ia (Isadora — ISA)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seções "Visão do fluxo", "Base de conhecimento" e "IA → Segurança").

## Quando a IA entra no fluxo
Só depois que o paciente envia o laudo e, na tela de exames, clica em "Explicar com IA" em **um** exame. Abre-se um chat daquele exame:
1. **1ª mensagem = explicação em 5 partes** (porta `POST /api/explicacoes`).
2. **Mensagens seguintes = respostas às dúvidas** que o paciente digita (porta `POST /api/chat`).
Quem chama esta pasta é sempre o orquestrador (`../api`), um analito por vez.

## Escopo desta pasta
- Cliente do modelo (Ollama Cloud, `gpt-oss`), configurado por variáveis de ambiente (`OLLAMA_*`).
- Prompt de instruções (versionado em `prompts/`, ex.: `v1`, `v2`) com as 5 partes na ordem fixa, e prompt do chat.
- Busca na base de conhecimento (RAG): a partir do `id_canonico` do analito, localizar a ficha em `exames.json` e injetá-la no prompt.
- Duas funções públicas: "analito + ficha → 5 partes" e "analito + ficha + histórico + mensagem → resposta do chat".
- Aceitar, numa nova tentativa, o motivo da reprovação da segurança e usá-lo para corrigir a resposta. **Quem decide tentar de novo e quantas vezes é o orquestrador**, não esta pasta.
- (P2) redação do tom do lembrete — horários e doses nunca vêm do modelo.

## Regras
- O modelo recebe SOMENTE dados estruturados e pseudonimizados + conteúdo da base. Nunca o texto bruto do laudo.
- O modelo NÃO decide classificação nem alerta: recebe isso pronto do pipeline e apenas explica.
- Se o conhecimento do modelo divergir da base, **a base prevalece** (diga isso no prompt).
- Proibido no texto gerado: diagnóstico, indicação/ajuste de medicamento, veredito de tranquilidade ou preocupação, a palavra "preocupante". Use "merece atenção".
- A explicação sai com as 5 partes em campos separados (formato do contrato). Como obter isso do modelo (ex.: pedir JSON) é decisão sua; documente o prompt e cada versão — vira material do artigo/apresentação.
- Chat: responde só sobre aquele exame (analito + ficha + histórico da conversa, que o orquestrador guarda na sessão), sem memória entre sessões; pergunta fora do exame → recusar com educação e indicar a especialidade da base; terminar cada resposta com o aviso. Passa pela mesma camada de segurança.
- Tratar timeout e indisponibilidade do modelo: devolver erro tipado, nunca travar a requisição.
- Confirmar logo: o modelo escolhido está disponível na sua conta do Ollama Cloud e dentro do limite gratuito? (Os limites do plano gratuito não foram verificados.)
- Para testar sem o pipeline, use os JSONs de `../../../samples/`.

## Modo de trabalho
[PREENCHER pela Isadora: como você quer trabalhar com o Claude Code nesta pasta — por exemplo, "guiado: explique e eu escrevo" ou "pode gerar com explicação". Enquanto isso, vale o padrão da raiz: explicar antes, passos pequenos, testar cada etapa isolada.]
