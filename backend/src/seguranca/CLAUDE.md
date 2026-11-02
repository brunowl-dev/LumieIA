# CLAUDE.md — backend/src/seguranca (Bruno — BWL)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seções "IA → Segurança" e "Regras de segurança").

## Escopo desta pasta
Proteger o que entra e o que sai do modelo:
- **Entrada (BWL-07):** `pseudonimizar.js` (lista de permissão + varredura de texto livre) e `registrarEvento.js` (log só com códigos e números). Doc: `docs/pseudonimizacao.md`.
- **Saída (BWL-08):** `verificarResposta.js`, `termosProibidos.json`, `mensagemPadrao.js`. Doc com as 7 verificações + estrutura e os códigos de motivo: `docs/seguranca-verificacoes.md`.

Verificar a resposta do modelo ANTES de ela chegar ao paciente. É código determinístico, sem modelo de linguagem. Vale para a explicação (1ª mensagem do chat) e para cada resposta do chat.

Verificações da **explicação** (5 partes):
1. **Aviso presente:** a parte 5 contém o aviso de que não substitui avaliação médica.
2. **Especialidade confere:** a especialidade citada é a da base de conhecimento para aquele exame (comparar ignorando maiúsculas e acentos).
3. **Sem diagnóstico, prescrição ou veredito:** nenhum termo/expressão proibida (ex.: "você tem", "o diagnóstico é", "tome", "dose", "prescrevo", "preocupante", "grave", "fique tranquilo", "nada de errado" — lista inicial, a completar).
4. (P1) **Ordem e completude:** as 5 partes existem e estão preenchidas.

Verificações da **resposta do chat** (texto livre): 1 (aviso presente no fim) e 3 (sem termos proibidos).

## O que esta pasta faz e o que NÃO faz
- Faz: avaliar (devolve aprovado/reprovado + **motivo**: qual verificação falhou) e montar a mensagem padrão.
- NÃO faz: chamar a IA nem contar tentativas. O laço de regeneração (até `MAX_REGENERACOES`) é do orquestrador (`../api`).

## Regras
- Armadilha conhecida: o aviso padrão contém palavras como "diagnóstico". **Remova o texto do aviso antes de procurar termos proibidos**, senão toda resposta correta seria reprovada.
- A lista de termos proibidos fica em arquivo de configuração próprio, fácil de ampliar. Pense em falsos positivos e falsos negativos e anote os casos que encontrar (vira material para o artigo/apresentação).
- A **mensagem padrão é montada sem o modelo**, então o fallback é seguro por construção:
  - explicação: finalidade do exame e especialidade da base + valor e posição do pipeline + aviso fixo;
  - chat: texto fixo do contrato ("Não consegui responder essa dúvida com segurança...") com a especialidade da base + aviso fixo.
- Devolver sempre o motivo da reprovação, para log e para o orquestrador repassar à IA na nova tentativa.
- Testes: use `../../../samples/respostas-ia/` (uma aprovada e duas reprovadas) e crie novos casos, inclusive respostas de chat. A camada precisa reprovar de verdade.

## Modo de trabalho (Bruno)
Modo GUIADO, como em `../pipeline/CLAUDE.md`: explique o conceito, passos pequenos, Bruno escreve, testa cada verificação isolada antes de juntar.
