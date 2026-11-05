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
  ['data nasc\\.?', 'nascimento'],
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
  ['ficha', null],
  ['cadastro', null],
  ['emiss[ãa]o', null],
  ['conv[êe]nio', null],
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
  const linhas = String(texto ?? '').split('\n');
  lerRotulosSozinhos(linhas, identificadores);
  for (const linha of linhas) {
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
      let valor = limparValor(linha.slice(rotulo.inicioValor, fim), CAMPOS_DE_PESSOA.has(rotulo.campo));
      // "3/14/1992, 34a": só a data (a idade não identifica).
      if (rotulo.campo === 'nascimento') valor = DATA.exec(valor ?? '')?.[0] ?? valor;
      if (valor) identificadores[rotulo.campo] = valor;
    });
  }
  // "Solicitante: CRM-SP-123456 NOME DO MÉDICO": o rótulo CRM vem antes do nome, então
  // o nome caiu no valor do CRM e o solicitante ficou vazio. Separa os dois.
  const crmComNome = /^([-\s/]*[a-z]{2}[-\s/]*[\d.]+|[\d.]+)\s+(\p{L}.*)$/iu.exec(identificadores.crm ?? '');
  if (crmComNome) {
    identificadores.crm = crmComNome[1].replace(/^[-\s/]+/, '');
    identificadores.medico ??= limparValor(crmComNome[2], true);
  }
  return identificadores;
}

// Data impressa: "14/03/1992", "3/14/1992".
const DATA = /\d{1,2}\/\d{1,2}\/\d{2,4}/;

// Cabeçalho em que o rótulo fica SOZINHO numa linha e o valor vem na de baixo
// ("CPF" / "000.000.000-00", "Médico" / "NOME Local Coleta"). Só estes rótulos,
// sem dois-pontos ou com, e a linha seguinte não vazia.
const ROTULOS_SOZINHOS = [
  [/^(?:nome|paciente)$/i, 'paciente'],
  [/^cpf$/i, 'cpf'],
  [/^rg$/i, 'rg'],
  [/^(?:data\s+de\s+)?nascimento$|^data\s+nasc\.?$/i, 'nascimento'],
  [/^m[ée]dico(?:\s+solicitante)?$|^solicitante$/i, 'medico'],
  [/^(?:pedido|protocolo|prontu[áa]rio)$/i, 'pedido'],
];
// Outra coluna do cabeçalho que vem na mesma linha do valor: "NOME Local Coleta".
const COLUNA_VIZINHA = /\s+local\s+(?:de\s+)?coleta\b.*$/i;

function lerRotulosSozinhos(linhas, identificadores) {
  for (let i = 0; i + 1 < linhas.length; i++) {
    const rotulo = linhas[i].trim().replace(/\s*:$/, '');
    const achado = ROTULOS_SOZINHOS.find(([regex]) => regex.test(rotulo));
    if (!achado) continue;
    const [, campo] = achado;
    const proxima = linhas[i + 1].replace(COLUNA_VIZINHA, '');
    let valor = limparValor(proxima, CAMPOS_DE_PESSOA.has(campo));
    if (campo === 'nascimento') valor = DATA.exec(valor ?? '')?.[0] ?? null;
    // Valor que é outro rótulo ("Nome Social:" logo abaixo) não conta.
    if (valor && identificadores[campo] === null && !valor.includes(':')) identificadores[campo] = valor;
  }
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
      .replace(/^\s*\d[\d./]*\s*[-–]\s*/, '') // código antes do nome: "000123 - NOME" (vem ANTES da regra do " - ")
      .replace(/\([^)]*\)?/g, ' ')            // "(fictícia)", "(CRM ..." sem fechar
      .replace(/\s-\s.*$/, ' ')               // " - registro FICTÍCIO"
      .replace(/^\s*dr[a]?\.?\s+/i, '');      // "Dr. " / "Dra. "
  }
  valor = valor.replace(/^[\s\-–—(),;:/]+|[\s\-–—(),;:/]+$/g, '').replace(/\s+/g, ' ');
  return valor || null;
}
