# samples/ — dados fictícios

**Tudo aqui é sintético.** Nunca coloque laudo real de pessoa (LGPD).

## O que há
- `glicose-normal.json`, `glicose-alterada.json`, `glicose-critica.json`: exemplos do "laudo estruturado" (saída do pipeline, formato do contrato). O limite crítico usado no exemplo crítico é **ilustrativo**: o limite real depende de fonte (tarefa BWL-05).
- `respostas-ia/`: exemplos de resposta do modelo para testar a camada de segurança: 1 aprovada, 1 reprovada por diagnóstico/prescrição, 1 reprovada por falta de aviso. São dados de teste, não saída de modelo real.

## A fazer
- `laudos/`: PDFs sintéticos (feitos no Word ou com IA e exportados) para cada exame, nas versões normal, acima e abaixo, e uma versão "foto" para o OCR (tarefa BWL-01). Cada laudo deve ter dados de paciente FICTÍCIOS.
