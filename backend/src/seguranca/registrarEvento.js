// Log do backend (BWL-07): só aceita CÓDIGOS e NÚMEROS, nunca texto livre.
// Motivo: texto livre no log é o caminho mais comum de vazamento (alguém loga a
// mensagem do chat "para depurar" e o CPF do paciente fica gravado).
//
// Também é uma lista de permissão:
// - o evento precisa estar em EVENTOS;
// - cada campo precisa estar em CAMPOS, com o tipo dele:
//   codigo  = uma palavra de letras/números/_ (ex.: "BAIXA_CONFIANCA", "glicose");
//   numero  = número finito com menos de 7 dígitos (CPF e telefone como número
//             têm 8 ou mais, então não passam);
//   codigos = lista de códigos.
// Campo desconhecido ou fora do formato é DESCARTADO (nunca escrito) e contado
// em `campos_descartados`. O log nunca lança erro: não pode derrubar a requisição.
// Limite: um único nome sem espaço ("Lucia") passaria num campo de código. A
// proteção é a lista de campos: nenhum deles é para texto do paciente.

export const EVENTOS = new Set([
  'LAUDO_PROCESSADO', 'REQUISICAO_RECUSADA',
  'EXPLICACAO_ENTREGUE', 'CHAT_RESPONDIDO', 'RESPOSTA_REPROVADA',
  'MODELO_INDISPONIVEL', 'ERRO_INTERNO', 'SERVIDOR_INICIADO',
]);

export const CAMPOS = {
  codigo: 'codigo', motivo: 'codigo', motivos: 'codigos', origem: 'codigo', origem_texto: 'codigo',
  id_canonico: 'codigo', rota: 'codigo', tentativa: 'numero', tentativas_regeneracao: 'numero',
  analitos: 'numero', itens_nao_lidos: 'numero', duracao_ms: 'numero', status_http: 'numero', porta: 'numero',
};

const CODIGO = /^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const ehCodigo = (v) => typeof v === 'string' && CODIGO.test(v);
const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1_000_000;
const VALIDADORES = {
  codigo: ehCodigo,
  numero: ehNumero,
  codigos: (v) => Array.isArray(v) && v.length <= 20 && v.every(ehCodigo),
};

/**
 * Cria um registrador. `escrever` recebe a linha pronta (JSON); os testes passam
 * uma função que guarda as linhas, o servidor usa o console.
 */
export function criarRegistrador({ escrever = (linha) => console.log(linha), agora = () => new Date() } = {}) {
  return function registrarEvento(evento, dados = {}) {
    try {
      const linha = { momento: agora().toISOString(), evento: EVENTOS.has(evento) ? evento : 'EVENTO_DESCONHECIDO' };
      let descartados = 0;
      for (const [campo, valor] of Object.entries(dados ?? {})) {
        const tipo = CAMPOS[campo];
        if (tipo && VALIDADORES[tipo](valor)) linha[campo] = valor;
        else descartados += 1;
      }
      if (descartados > 0) linha.campos_descartados = descartados;
      escrever(JSON.stringify(linha));
    } catch {
      // Log nunca derruba a requisição.
    }
  };
}

export const registrarEvento = criarRegistrador();
