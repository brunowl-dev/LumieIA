# CLAUDE.md — Lumie (módulo de IA)

Este arquivo orienta o Claude Code em TODO o repositório. Cada pasta de área tem um `CLAUDE.md` próprio com regras mais específicas.
Ordem de leitura: este arquivo → o `CLAUDE.md` da pasta em que você está trabalhando → `docs/contrato.md`.

## Contexto
- Lumie é um hub de saúde digital (exames, consultas, medicações). Este repositório contém SOMENTE o módulo de IA, apresentado como artigo de iniciação científica no COBRIC (Santos). Apresentação: **05/11/2026**.
- Autores: Bruno Antonio Wai Lu, Isadora Oliveira da Silva, Maria Eduarda Aguiar Duarte (Fatec Rubens Lara, ADS).
- O artigo JÁ FOI ENVIADO e não pode mudar (texto em `docs/artigo/artigo-cobric.docx`, banner em `docs/artigo/banner-cobric.pdf`). **O protótipo é que precisa corresponder ao artigo.** Se o código divergir do artigo, avise a pessoa e registre em `docs/artigo-vs-prototipo.md`.

## O que o módulo faz
1. Interpretação de exames, em três momentos (diagrama em `docs/contrato.md` §1):
   - **Envio (sem IA):** o paciente envia o laudo (PDF digital ou foto) → texto extraído (pdf-parse; OCR com Tesseract.js) → estruturado por analito (nome, valor, unidade, faixa de referência do laudo) → classificado por REGRAS DETERMINÍSTICAS (dentro/acima/abaixo; limites críticos por analito acionam alerta prioritário) → a tela de exames mostra cada exame com valor, faixa, cor e alerta.
   - **Explicação (sob demanda):** em cada exame há um botão "Explicar com IA". Ao clicar, abre um chat daquele exame cuja 1ª mensagem é a explicação: o modelo de linguagem recebe os dados estruturados do analito + conteúdo da base de conhecimento (RAG) + prompt, e escreve SEMPRE nesta ordem: (1) o que o exame avalia; (2) valor obtido e posição na faixa; (3) significado sem afirmar doença; (4) especialidade recomendada; (5) aviso de que não substitui avaliação médica → camada de segurança verifica a resposta antes de exibir; se falhar, o orquestrador pede nova resposta ou usa mensagem padrão.
   - **Dúvidas:** no mesmo chat, o paciente digita perguntas sobre aquele exame; cada resposta também passa pela camada de segurança.
2. Lembretes (P2, só se sobrar tempo): a partir de medicações/consultas cadastradas; o modelo só redige o tom; horários e doses vêm sempre dos dados cadastrados.

## Princípios inegociáveis
- A IA NÃO diagnostica, NÃO indica nem ajusta medicamento, NÃO dá veredito conclusivo de tranquilidade ou de preocupação. Linguagem de "merece atenção", sem a palavra "preocupante".
- A classificação (dentro/acima/abaixo) e o alerta crítico são SEMPRE por regra determinística no código. O modelo de linguagem nunca decide isso.
- Dados enviados ao modelo são pseudonimizados (LGPD): o modelo recebe apenas dados estruturados, nunca o texto bruto do laudo nem identificadores do paciente.
- Somente laudos SINTÉTICOS/fictícios no repositório e nos testes. Nunca exames reais de pessoas.
- Nunca commitar segredos (`.env`, chaves de API).

## Donos e pastas
| Pasta | Dono |
|---|---|
| `backend/src/pipeline`, `backend/src/seguranca`, `backend/src/api` | Bruno (BWL) |
| `backend/src/ia` | Isadora (ISA) |
| `frontend`, `docs/base-conhecimento` | Aguiar (MAG) |
| `docs/contrato.md`, `docs/tasklist.md`, `docs/artigo-vs-prototipo.md`, `samples/` | todos (alterações combinadas no grupo) |

Regra: edite apenas a pasta do dono da sessão. Se precisar tocar em outra pasta, PARE e peça confirmação à pessoa.
A ligação front↔back (quem faz) está em aberto — veja "Decisões em aberto" no contrato.

## Stack e execução
- Front: React. Back: Node.js. Modelo do protótipo: gpt-oss via Ollama Cloud (o artigo diz "família GPT via API" — divergência já registrada).
- **A aplicação roda em Docker por enquanto.** Configuração por variáveis de ambiente: copie `.env.example` para `.env` e preencha. Nunca commite o `.env`.
- Dentro do Docker, os serviços se comunicam pelo NOME do serviço (ex.: `backend`), não por `localhost`. Veja `docs/docker.md`.
- O modelo roda na nuvem: a demo precisa de internet. Plano B: vídeo gravado.

## Modo de trabalho padrão (cada pessoa pode ajustar no CLAUDE.md da sua pasta)
Cada integrante precisa DEFENDER seu trabalho perante a banca. Portanto, por padrão:
- Explique o conceito antes de implementar.
- Avance em passos pequenos; peça para a pessoa testar cada etapa isolada antes de integrar.
- Não despeje código sem explicar os trechos relevantes. Se a pessoa pedir algo que a leve a aceitar código sem entender, avise.
- Seja direto e crítico: se uma afirmação do artigo não estiver sustentada pelo protótipo, diga.

## Git
- Branches por área: `bruno/...`, `isadora/...`, `aguiar/...`. Commits pequenos e descritivos. Nada de commit direto de mudança de contrato sem avisar o grupo.
- Mudou o contrato? Atualize `docs/contrato.md` na MESMA branch e avise os outros dois.
