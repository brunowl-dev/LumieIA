# CLAUDE.md — frontend (Aguiar — MAG)

Leia antes: `../CLAUDE.md` e `../docs/contrato.md` (seções "Visão do fluxo", "Orquestrador → Front", "Portas HTTP" e "Erros").

## Escopo desta pasta
React. O fluxo das telas:
1. **Envio do laudo** (PDF/foto) → `POST /api/laudos`.
2. **Tela de exames:** um cartão por exame com nome, valor, faixa de referência, status com cor e alerta de atendimento prioritário (quando houver). Cada exame com `explicacao_disponivel: true` tem um botão **"Explicar com IA"**; os demais mostram "ainda não temos explicação para este exame".
3. **Chat do exame** (abre ao clicar no botão): mostra "carregando" enquanto chama `POST /api/explicacoes`; a 1ª mensagem é a explicação nas 5 partes (na ordem), com a especialidade e o aviso. Depois o paciente digita dúvidas → `POST /api/chat`. Cada chat é de um exame só.
- Estados de erro (um por código do contrato) em cada uma das três telas.

## Regras
- Consumir SOMENTE o formato do contrato. Enquanto o back não existir, trabalhe com os JSONs de `../samples/respostas-api/`.
- Cores: verde = dentro da faixa; amarelo = fora da faixa (acima/abaixo); vermelho = alerta crítico. (Decisão a confirmar no contrato.)
- O alerta prioritário aparece já na tela de exames; ele não depende de o paciente abrir o chat.
- **Não depender só de cor:** sempre acompanhar com texto e/ícone (acessibilidade, daltonismo).
- O aviso "não substitui avaliação médica" deve estar sempre visível na tela de exames e no chat.
- Linguagem simples. Para cada código de erro do contrato, mostrar a mensagem de `mensagem_usuario` e a ação (ex.: "enviar novamente").
- Nenhuma lógica de classificação no front: o status vem pronto.
- Chame a API sempre por caminho relativo (`fetch('/api/laudos')`), nunca com `http://localhost:3001`. No Docker, o nginx repassa `/api/` ao backend (sem CORS); no `npm run dev`, o `vite.config.js` faz o mesmo. Veja `../docs/docker.md`.
- Stack: React + Vite, npm. Instale pacotes com `npm install` e commite o `package-lock.json` (o Docker usa `npm ci`).
- Não commitar chaves nem `.env`.

## Modo de trabalho
[PREENCHER pela Aguiar: como você quer trabalhar com o Claude Code nesta pasta — por exemplo, "pode gerar telas com explicação do que cada parte faz". Enquanto isso, vale o padrão da raiz: explicar antes e passos pequenos, para você conseguir defender o front na apresentação.]
