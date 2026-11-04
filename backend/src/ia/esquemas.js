// JSON SCHEMAS DAS RESPOSTAS (ISA-03, contrato §4.1, §4.3 e §4.4).
// Vão no campo `format` do pedido ao Ollama: o modelo é obrigado a devolver um
// JSON com exatamente estes campos, em vez de texto livre. O schema garante só a
// FORMA (campos de texto presentes); o CONTEÚDO quem confere é a camada de segurança.

const texto = { type: 'string' };

/** As 5 partes da explicação, na ordem do contrato §4.3. */
export const ESQUEMA_EXPLICACAO = {
  type: 'object',
  properties: {
    o_que_avalia: texto,
    valor_e_posicao: texto,
    significado: texto,
    especialidade: texto,
    aviso: texto,
  },
  required: ['o_que_avalia', 'valor_e_posicao', 'significado', 'especialidade', 'aviso'],
};

/** A resposta de uma dúvida do chat (contrato §4.4). */
export const ESQUEMA_CHAT = {
  type: 'object',
  properties: { resposta: texto },
  required: ['resposta'],
};
