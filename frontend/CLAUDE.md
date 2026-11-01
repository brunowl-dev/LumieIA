# CLAUDE.md — frontend (Aguiar — MAG)

Leia antes: `../CLAUDE.md` e `../docs/contrato.md` (seções "Segurança → Front", "Portas HTTP" e "Erros").

## Escopo desta pasta
- React. Telas: envio de laudo (PDF/foto), cartão de resultado, estados de erro, alerta de atendimento prioritário, chat sobre o exame.
- O cartão mostra: analito, valor, faixa de referência, status com cor, a explicação nas 5 partes (na ordem), a especialidade e o aviso.

## Regras
- Consumir SOMENTE o formato do contrato. Enquanto o back não existir, trabalhe com os JSONs de `../samples/`.
- Cores: verde = dentro da faixa; amarelo = fora da faixa (acima/abaixo); vermelho = alerta crítico. (Decisão a confirmar no contrato.)
- **Não depender só de cor:** sempre acompanhar com texto e/ícone (acessibilidade, daltonismo).
- O aviso "não substitui avaliação médica" deve estar sempre visível no cartão.
- Linguagem simples. Para cada código de erro do contrato, mostrar a mensagem de `mensagem_usuario` e a ação (ex.: "enviar novamente").
- Nenhuma lógica de classificação no front: o status vem pronto.
- A URL da API vem de variável de ambiente (`VITE_API_URL` ou equivalente — veja `../.env.example`). Dentro do Docker, o navegador acessa a API pelo `localhost` do computador, não pelo nome do serviço.
- Não commitar chaves nem `.env`.

## Modo de trabalho
[PREENCHER pela Aguiar: como você quer trabalhar com o Claude Code nesta pasta — por exemplo, "pode gerar telas com explicação do que cada parte faz". Enquanto isso, vale o padrão da raiz: explicar antes e passos pequenos, para você conseguir defender o front na apresentação.]
