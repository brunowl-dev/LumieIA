# Artigo × protótipo

O artigo já foi enviado e não pode mudar. Esta tabela lista o que o protótipo faz de diferente (ou ainda não faz). **Quem for apresentar precisa saber explicar cada linha.** Atualize sempre que o código divergir.

| Item | O que o artigo diz | O que o protótipo faz | Situação / como explicar |
|---|---|---|---|
| Modelo de linguagem | Família GPT (OpenAI) via API | gpt-oss via Ollama Cloud | Divergência. Argumento: custo e ausência de máquina local para rodar modelo aberto. Verificar se a justificativa convence |
| RAG | Base de conhecimento da equipe alimenta o modelo | Busca por chave (identificador do exame) na base, sem busca vetorial | Compatível: recupera conhecimento e injeta no prompt. Com poucos exames não há ganho em busca vetorial; entra se a base crescer |
| Classificação | Regras determinísticas | Regras determinísticas | Igual ao artigo |
| OCR | Tesseract.js | P1: pode não estar pronto | Se não ficar pronto, é afirmação sem sustentação no protótipo: apresentar como previsto |
| Camada de segurança | Aviso, especialidade conferida com a base, termos de diagnóstico/prescrição | Igual; acrescenta veredito (ex.: "preocupante") à lista de termos | Igual ao artigo, com lista ampliada |
| Pseudonimização | Dados enviados ao modelo pseudonimizados | O modelo recebe só dados estruturados, sem identificadores | Igual, e mais restritivo (nem texto bruto vai ao modelo) |
| Chat | Não descrito | Chat sobre o exame da sessão | Extensão do protótipo, não está no artigo. Dizer que é extensão, e que passa pela mesma camada de segurança |
| Lembretes | Descritos | P2: só se sobrar tempo | Se não ficar pronto, apresentar como previsto |
| Execução | Não descrito | Docker | Detalhe de implementação |
| Avaliação com usuários | Não houve (trabalho futuro: legibilidade, revisão por profissionais, usabilidade) | Não houve | Não afirmar que o texto foi validado por profissionais de saúde |
