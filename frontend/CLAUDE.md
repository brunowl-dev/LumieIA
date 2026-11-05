# CLAUDE.md — frontend (Aguiar — MAG)

Leia antes: `../CLAUDE.md` e `../docs/contrato.md` (seções "Visão do fluxo", "Orquestrador → Front", "Portas HTTP" e "Erros").

## Escopo desta pasta
React. O fluxo das telas:
0. **Catálogo (tela inicial):** laudos de demonstração SINTÉTICOS (`src/laudosDemo.js`, arquivos copiados de `samples/laudos/` para `public/laudos/`). Escolher um → confirmar o consentimento → o front baixa o arquivo e o envia por `POST /api/laudos`, igual ao envio manual (o back lê de verdade). O envio manual fica num link no fim do catálogo.
1. **Envio do laudo** (PDF/foto) → `POST /api/laudos`.
   - **Pré-visualização** (`components/PreviaArquivo.jsx`), no catálogo e no envio: PDF no leitor do navegador (`<iframe>`), foto em `<img>`, com link "Abrir em tamanho real". No envio manual o arquivo vira um endereço local (`blob:`), liberado ao trocar de arquivo: nada sai do navegador antes do clique em enviar.
2. **Tela de exames:** um cartão por exame com nome, valor, faixa de referência, status com cor e alerta de atendimento prioritário (quando houver). Cada exame com `explicacao_disponivel: true` tem um botão **"Explicar com IA"**; os demais mostram "ainda não temos explicação para este exame".
3. **Chat do exame** (abre ao clicar no botão): mostra "carregando" enquanto chama `POST /api/explicacoes`; a 1ª mensagem é a explicação nas 5 partes (na ordem), com a especialidade e o aviso. Depois o paciente digita dúvidas → `POST /api/chat`. Cada chat é de um exame só.
4. **Todas as explicações** (botão "Explicar todos com IA", com 2 ou mais exames explicáveis): a explicação de cada exame, uma embaixo da outra, pedida exame por exame em `POST /api/explicacoes` (sem rota nova). As conversas ficam no `App` (`main.jsx`): o chat aberto depois retoma a mesma explicação, sem pedir outra ao modelo.
- Estados de erro (um por código do contrato) em cada uma das telas.

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
- O Claude pode gerar cada tela/componente completo, mas deve explicar o que cada parte faz e por quê.
- Uma tela por vez: eu testo cada uma antes de seguir para a próxima.
- Visual: seguir o design do app Lumie (https://lumie-iomr7wajd-lumie7.vercel.app/), recriando só as telas do módulo (envio, exames, chat do exame, erros, alerta).
