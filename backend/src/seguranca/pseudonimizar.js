// Pseudonimização da entrada da IA (BWL-07). Funções puras, sem rede nem log.
// Explicação das duas camadas e dos limites: docs/pseudonimizacao.md.
//
// - pseudonimizarTexto: VARREDURA de texto livre. Troca identificadores por
//   marcadores ("[PACIENTE_1]", "[CPF_1]") e devolve o mapa marcador → valor.
// - montarEntradaIa: LISTA DE PERMISSÃO. Monta, campo a campo, a única coisa que
//   a IA recebe; o texto livre que entra passa pela varredura.

// --- Normalização ----------------------------------------------------------

// "Lúcia" → "lucia". NFD separa a letra do acento; \p{M} são os acentos soltos.
export function semAcento(texto) {
  return String(texto).normalize('NFD').replace(/\p{M}/gu, '');
}

// Para cada letra sem acento, as variantes com acento. Assim a regex do nome
// "Lúcia" acha "LUCIA", "lucia" e "Lúcia" (a flag "i" cuida de maiúsculas).
const VARIANTES = {
  a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ',
};
// (Sem "-": com a flag "u", "\-" fora de [] é escape inválido; e "-" solto já é literal.)
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Regex de um termo do dicionário: sem diferenciar maiúsculas/acentos, espaços
// flexíveis e só em palavra inteira ("Ana" não casa dentro de "Banana").
function regexDoTermo(termo) {
  const corpo = [...semAcento(termo).toLowerCase().trim()]
    .map((ch) => (/\s/.test(ch) ? '\\s+' : VARIANTES[ch] ? `[${VARIANTES[ch]}]` : escaparRegex(ch)))
    .join('')
    .replace(/(\\s\+)+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, 'giu');
}

// --- Dicionário: o que veio do cabeçalho do laudo ----------------------------

// Preposições do nome não são identificador ("da", "de"...): trocar "de" em todo
// o texto destruiria a frase. Partes com menos de 3 letras também ficam de fora.
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);
const CATEGORIA_DO_CAMPO = {
  paciente: 'PACIENTE', medico: 'PROFISSIONAL', responsavel_tecnico: 'PROFISSIONAL',
  cpf: 'CPF', rg: 'RG', nascimento: 'DATA', pedido: 'PEDIDO', crm: 'CRM',
};
const CAMPOS_DE_PESSOA = new Set(['paciente', 'medico', 'responsavel_tecnico']);

function termosDoDicionario(identificadores = {}) {
  const termos = [];
  for (const [campo, valor] of Object.entries(identificadores ?? {})) {
    const categoria = CATEGORIA_DO_CAMPO[campo];
    if (!categoria || typeof valor !== 'string' || !valor.trim()) continue;
    if (CAMPOS_DE_PESSOA.has(campo)) {
      termos.push({ categoria, termo: valor }); // nome completo
      for (const parte of valor.split(/\s+/)) {   // e cada parte ("Lúcia", "Andrade")
        if (parte.length >= 3 && !PARTICULAS.has(semAcento(parte).toLowerCase())) termos.push({ categoria, termo: parte });
      }
    } else if (/\d/.test(valor)) {
      // Número do cabeçalho do jeito que foi impresso ("TESTE-0001"). Valor sem
      // dígito ("FICTÍCIO") não entra: viraria a troca de uma palavra comum.
      termos.push({ categoria, termo: valor });
    }
  }
  // Mais longo primeiro: o nome completo vira UM marcador antes de as partes serem procuradas.
  return termos.sort((a, b) => b.termo.length - a.termo.length);
}

// --- Padrões: o que a pessoa pode digitar no chat ----------------------------
// Ordem importa: o e-mail roda ANTES do dicionário (senão "lucia.teste@..."
// vira "[PACIENTE_1].[PACIENTE_2]@..." e o domínio sobra); CPF antes de
// telefone e CEP (todos são sequências de dígitos). Cada padrão tem um grupo
// "rotulo" opcional (ex.: "protocolo ") que é mantido; só o valor vira marcador.
const MESES = 'janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
const PADRAO_EMAIL = { categoria: 'EMAIL', regex: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/giu };
const PADROES = [
  { categoria: 'CRM', regex: /(?<rotulo>\bCRM[\s:/-]*)(?:[A-Z]{2}[\s:/-]*)?\d{4,7}\b/giu },
  { categoria: 'PEDIDO', regex: /(?<rotulo>\b(?:pedido|protocolo|prontu[aá]rio|atendimento|requisi[cç][aã]o)(?:\s*(?:n[º°o]\.?|n[uú]mero))?\s*:?\s*)[A-Z]*[-/.]?\d[\w\-/.]*/giu },
  { categoria: 'RG', regex: /(?<rotulo>\bRG\s*:?\s*)[\dxX][\dxX.\-]{4,}/giu },
  { categoria: 'RG', regex: /\b\d{1,2}\.\d{3}\.\d{3}-[\dxX]\b/gu },
  // Não pode encostar em outro dígito; ponto final de frase depois do CPF é permitido.
  { categoria: 'CPF', regex: /(?<!\d|\d\.)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d|\.\d)/gu },
  { categoria: 'DATA', regex: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/gu },
  { categoria: 'DATA', regex: new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MESES})(?:\\s+de\\s+\\d{4})?\\b`, 'giu') },
  { categoria: 'TELEFONE', regex: /(?:\+?55\s?)?(?:\(\d{2}\)\s?|\b\d{2}\s)?\b9?\d{4}[\s-]?\d{4}\b/gu },
  { categoria: 'CEP', regex: /\b\d{5}-?\d{3}\b/gu },
];

// "meu nome é Lúcia Andrade" / "me chamo lúcia": as palavras seguintes são nome,
// mesmo que o laudo não tenha sido lido. Para em pontuação ou palavra de ligação.
const GATILHO_NOME = /(?<![\p{L}])(?:meu\s+nome\s+(?:[eé]|completo\s+[eé])|me\s+chamo|chamo-me)\s*:?\s+/giu;
const PARA_NOME = new Set(['e', 'eu', 'meu', 'minha', 'tenho', 'sou', 'com', 'que', 'mas', 'o', 'a', 'os', 'as', 'no', 'na', 'fiz', 'estou', 'nasci', 'cpf', 'rg']);

// --- Varredura ----------------------------------------------------------------

/**
 * Troca identificadores do texto livre por marcadores.
 * @param {string} texto texto livre (mensagem do chat, histórico, nome do exame)
 * @param {object} identificadores saída de extrairIdentificadores (pode ser {})
 * @param {Record<string,string>} [mapaAnterior] mapa da sessão: o mesmo valor
 *   continua com o mesmo marcador entre mensagens
 * @returns {{ texto: string, mapa: Record<string,string> }} mapa = marcador → valor original
 */
export function pseudonimizarTexto(texto, identificadores = {}, mapaAnterior = {}) {
  const mapa = { ...mapaAnterior };
  const marcador = (categoria, valor) => obterMarcador(mapa, categoria, valor);
  let saida = String(texto ?? '');
  const aplicar = ({ categoria, regex }) => {
    saida = saida.replace(regex, (...args) => {
      const achado = args[0];
      const rotulo = args.at(-1)?.rotulo ?? ''; // grupo nomeado, quando existe
      return rotulo + marcador(categoria, achado.slice(rotulo.length));
    });
  };

  // 0) E-mail inteiro, antes que o dicionário quebre o nome dentro dele.
  aplicar(PADRAO_EMAIL);

  // 1) Dicionário: nome do paciente e números do cabeçalho, em qualquer grafia.
  for (const { categoria, termo } of termosDoDicionario(identificadores)) {
    saida = saida.replace(regexDoTermo(termo), (achado) => marcador(categoria, achado));
  }

  // 2) "meu nome é X".
  saida = trocarNomeDeclarado(saida, marcador);

  // 3) Padrões de formato (CPF, telefone...).
  PADROES.forEach(aplicar);
  return { texto: saida, mapa };
}

// Mesmo valor (ignorando caixa, acento e pontuação) → mesmo marcador.
function obterMarcador(mapa, categoria, valor) {
  const chave = (v) => semAcento(v).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const existente = Object.keys(mapa).find((m) => m.startsWith(`[${categoria}_`) && chave(mapa[m]) === chave(valor));
  if (existente) return existente;
  const numero = Object.keys(mapa).filter((m) => m.startsWith(`[${categoria}_`)).length + 1;
  const novo = `[${categoria}_${numero}]`;
  mapa[novo] = valor;
  return novo;
}

function trocarNomeDeclarado(texto, marcador) {
  let saida = '';
  let posicao = 0;
  for (const gatilho of texto.matchAll(GATILHO_NOME)) {
    const inicio = gatilho.index + gatilho[0].length;
    if (inicio < posicao) continue;
    // Junta até 5 palavras seguidas; "da/de" só contam se vier outra palavra depois.
    const palavras = [...texto.slice(inicio).matchAll(/[\p{L}'][\p{L}'-]*|[^\p{L}'\s]|\s+/gu)];
    let fim = inicio;
    let tomadas = 0;
    for (const p of palavras) {
      const s = p[0];
      if (/^\s+$/.test(s)) continue;
      if (!/^\p{L}/u.test(s) || s.startsWith('[')) break;      // pontuação, número, marcador
      const norm = semAcento(s).toLowerCase();
      if (PARTICULAS.has(norm) && tomadas > 0) continue; // "da" só entra se vier outra palavra
      if (PARA_NOME.has(norm) || tomadas >= 5) break;
      tomadas += 1;
      fim = inicio + p.index + s.length;
    }
    if (tomadas === 0) continue;
    saida += texto.slice(posicao, inicio) + marcador('PACIENTE', texto.slice(inicio, fim));
    posicao = fim;
  }
  return saida + texto.slice(posicao);
}

// --- Lista de permissão ---------------------------------------------------------

/**
 * Monta a ENTRADA da IA: o único objeto que o modelo recebe.
 * Lista de permissão: só os campos abaixo entram. Texto livre passa pela varredura.
 * @param {object} dados
 * @param {object} dados.analito item do laudo estruturado (contrato §2)
 * @param {object} dados.ficha ficha da base (contrato §3)
 * @param {object} [dados.identificadores] da sessão (lista do que apagar)
 * @param {Record<string,string>} [dados.mapa] mapa da sessão
 * @param {string} [dados.mensagem] nova mensagem do chat
 * @param {{papel:'paciente'|'assistente', texto:string}[]} [dados.historico] conversa daquele exame
 * @param {object} [opcoes]
 * @param {typeof pseudonimizarTexto} [opcoes.varrer] só os testes trocam (teste de controle)
 * @returns {{ entrada: object, mapa: Record<string,string> }}
 */
export function montarEntradaIa(
  { analito, ficha, identificadores = {}, mapa = {}, mensagem, historico } = {},
  { varrer = pseudonimizarTexto } = {},
) {
  let mapaAtual = mapa;
  const limpar = (texto) => {
    const r = varrer(texto, identificadores, mapaAtual);
    mapaAtual = r.mapa;
    return r.texto;
  };
  const faixa = analito.faixa_referencia ?? {};
  const entrada = {
    analito: {
      id_canonico: analito.id_canonico,
      nome_no_laudo: limpar(analito.nome_no_laudo ?? ''),
      valor: analito.valor,
      unidade: analito.unidade,
      faixa_referencia: {
        minimo: faixa.minimo ?? null,
        maximo: faixa.maximo ?? null,
        minimo_inclusivo: faixa.minimo_inclusivo ?? null,
        maximo_inclusivo: faixa.maximo_inclusivo ?? null,
      },
      classificacao: analito.classificacao,
      alerta_critico: analito.alerta_critico,
    },
    // Conteúdo da equipe (base de conhecimento), não do paciente.
    ficha: {
      id_canonico: ficha.id_canonico,
      o_que_avalia: ficha.o_que_avalia,
      especialidade: ficha.especialidade,
    },
  };
  if (historico !== undefined) {
    entrada.historico = historico.map((m) => ({ papel: m.papel === 'paciente' ? 'paciente' : 'assistente', texto: limpar(m.texto) }));
  }
  if (mensagem !== undefined) entrada.mensagem = limpar(mensagem);
  return { entrada, mapa: mapaAtual };
}
