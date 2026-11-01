# CLAUDE.md — backend/src/seguranca (Bruno — BWL)

Leia antes: `../../../CLAUDE.md`, `../../CLAUDE.md` e `../../../docs/contrato.md` (seções "IA → Segurança" e "Regras de segurança").

## Escopo desta pasta
Verificar a resposta do modelo ANTES de ela chegar ao paciente. É código determinístico, sem modelo de linguagem.

Verificações (para cada analito explicado):
1. **Aviso presente:** a parte 5 contém o aviso de que não substitui avaliação médica.
2. **Especialidade confere:** a especialidade citada é a da base de conhecimento para aquele exame (comparar ignorando maiúsculas e acentos).
3. **Sem diagnóstico, prescrição ou veredito:** nenhum termo/expressão proibida (ex.: "você tem", "o diagnóstico é", "tome", "dose", "prescrevo", "preocupante", "grave", "fique tranquilo", "nada de errado" — lista inicial, a completar).
4. (P1) **Ordem e completude:** as 5 partes existem e estão preenchidas.

Se reprovar: pedir regeneração (até `MAX_REGENERACOES`) e, esgotadas as tentativas, usar a **mensagem padrão**.

## Regras
- Armadilha conhecida: o aviso padrão contém palavras como "diagnóstico". **Remova o texto do aviso antes de procurar termos proibidos**, senão toda resposta correta seria reprovada.
- A lista de termos proibidos fica em arquivo de configuração próprio, fácil de ampliar. Pense em falsos positivos e falsos negativos e anote os casos que encontrar (vira material para o artigo/apresentação).
- A **mensagem padrão é montada sem o modelo**: com a finalidade do exame e a especialidade vindas da base, o valor e a posição vindos do pipeline, e o aviso fixo. Assim o fallback é seguro por construção.
- Devolver sempre o motivo da reprovação (qual verificação falhou), para log e para a regeneração.
- Testes: use `../../../samples/respostas-ia/` (uma aprovada e duas reprovadas) e crie novos casos. A camada precisa reprovar de verdade.

## Modo de trabalho (Bruno)
Modo GUIADO, como em `../pipeline/CLAUDE.md`: explique o conceito, passos pequenos, Bruno escreve, testa cada verificação isolada antes de juntar.
