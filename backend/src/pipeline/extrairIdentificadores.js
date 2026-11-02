// Identificadores do paciente lidos do cabeçalho do laudo (BWL-07).
// Função pura: texto do laudo → { paciente, cpf, rg, nascimento, pedido, medico,
// crm, responsavel_tecnico }. Cada campo é texto ou null.
//
// Para que serve: NÃO é para mostrar nem para enviar a ninguém. É a lista do que
// a varredura (src/seguranca/pseudonimizar.js) deve apagar do texto livre do chat.
// Fica só na sessão em memória do servidor e some quando ela expira.
// Detalhes: docs/pseudonimizacao.md.
//
// Como funciona: em cada linha, procura os RÓTULOS conhecidos ("Paciente:",
// "CPF:", "Solicitante:"...). O valor de um rótulo é o texto entre ele e o
// próximo rótulo da mesma linha (ou o fim da linha). Ex.:
//   "Paciente: Maria Teste da Silva Pedido nº: TESTE-0001"
//    └rótulo─┘ └──── valor ────────┘ └rótulo──┘ └ valor ┘

// [padrão do rótulo, campo]. Campo null = rótulo que só serve de DELIMITADOR
// (sexo, idade, datas da coleta): marca onde o valor anterior termina, mas não
// é guardado. Mais longo antes do mais curto ("Data de nascimento" antes de
// "Nascimento"), para a alternância da regex pegar o rótulo inteiro.
const ROTULOS = [
  ['data de nascimento', 'nascimento'],
  ['nascimento', 'nascimento'],
  ['m[ée]dico solicitante', 'medico'],
  ['solicitante', 'medico'],
  ['respons[áa]vel t[ée]cnico', 'responsavel_tecnico'],
  ['liberado eletronicamente por', 'responsavel_tecnico'],
  ['paciente', 'paciente'],
  ['nome', 'paciente'],
  ['cpf', 'cpf'],
  ['rg', 'rg'],
  ['pedido(?: n[º°o.]*)?', 'pedido'],
  ['protocolo', 'pedido'],
  ['prontu[áa]rio', 'pedido'],
  ['atendimento', 'pedido'],
  ['sexo', null],
  ['idade', null],
  ['data da coleta', null],
  ['coleta', null],
  ['data de libera[çc][ãa]o', null],
  ['libera[çc][ãa]o', null],
];

// Rótulo = início de palavra + nome do rótulo + ":". O CRM é exceção: aparece
// também sem dois-pontos ("(CRM FICTÍCIO)").
const REGEX_ROTULO = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:(${ROTULOS.map(([p]) => p).join('|')})\\s*:|(crm)\\b\\s*:?)`,
  'giu',
);

const CAMPOS = ['paciente', 'cpf', 'rg', 'nascimento', 'pedido', 'medico', 'crm', 'responsavel_tecnico'];
const CAMPOS_DE_PESSOA = new Set(['paciente', 'medico', 'responsavel_tecnico']);

/**
 * @param {string} texto texto extraído do laudo (contém dados do paciente)
 * @returns {Record<string, string|null>} um campo por identificador; null se não achou
 */
export function extrairIdentificadores(texto) {
  const identificadores = Object.fromEntries(CAMPOS.map((campo) => [campo, null]));
  for (const linha of String(texto ?? '').split('\n')) {
    // 1) Acha todos os rótulos da linha, com a posição de cada um.
    const rotulos = [...linha.matchAll(REGEX_ROTULO)].map((m) => ({
      campo: m[2] ? 'crm' : campoDoRotulo(m[1]),
      inicioValor: m.index + m[0].length,
      inicioRotulo: m.index,
    }));
    // 2) O valor de cada rótulo vai até o próximo rótulo (ou o fim da linha).
    rotulos.forEach((rotulo, i) => {
      if (!rotulo.campo || identificadores[rotulo.campo] !== null) return; // fica o 1º (cabeçalho)
      const fim = i + 1 < rotulos.length ? rotulos[i + 1].inicioRotulo : linha.length;
      const valor = limparValor(linha.slice(rotulo.inicioValor, fim), CAMPOS_DE_PESSOA.has(rotulo.campo));
      if (valor) identificadores[rotulo.campo] = valor;
    });
  }
  return identificadores;
}

function campoDoRotulo(rotuloLido) {
  const minusculo = rotuloLido.toLowerCase();
  const achado = ROTULOS.find(([padrao]) => new RegExp(`^(?:${padrao})$`, 'iu').test(minusculo));
  return achado ? achado[1] : null;
}

// Tira pontuação das pontas ("Dr. João Exemplo -" → "Dr. João Exemplo") e, em
// nome de pessoa, o título ("Dr.", "Dra.") e observações entre parênteses.
function limparValor(bruto, ehPessoa) {
  let valor = bruto;
  if (ehPessoa) {
    valor = valor
      .replace(/\([^)]*\)?/g, ' ')            // "(fictícia)", "(CRM ..." sem fechar
      .replace(/\s-\s.*$/, ' ')               // " - registro FICTÍCIO"
      .replace(/^\s*dr[a]?\.?\s+/i, '');      // "Dr. " / "Dra. "
  }
  valor = valor.replace(/^[\s\-–—(),;:/]+|[\s\-–—(),;:/]+$/g, '').replace(/\s+/g, ' ');
  return valor || null;
}
