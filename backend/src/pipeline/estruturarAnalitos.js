// Etapa 2 do pipeline (BWL-03): transformar o texto do laudo (saída da BWL-02)
// em dados por analito: nome, valor, unidade e faixa de referência do laudo.
// Só parsing determinístico: não classifica (BWL-05), não normaliza o nome
// (BWL-04), não usa o modelo. Não grava log: o texto é dado de saúde.

// Números como impressos em laudo brasileiro: vírgula é decimal, ponto é milhar.
// Cada regex é testada no texto INTEIRO (^ ... $), então "13,8 mg" não casa.
//
// 1) Só dígitos, com vírgula decimal opcional: "88", "13,8", "0,45".
//    \d+        um ou mais dígitos
//    (,\d+)?    opcional: vírgula seguida de um ou mais dígitos
const NUMERO_VIRGULA_DECIMAL = /^\d+(,\d+)?$/;
// 2) Ponto de milhar, com vírgula decimal opcional: "5.000", "1.234,5".
//    [1-9]\d{0,2}  primeiro grupo: 1 a 3 dígitos, sem começar com 0
//                  (assim "0.450" não vira 450)
//    (\.\d{3})+    um ou mais grupos de ponto + exatamente 3 dígitos
//    (,\d+)?       opcional: parte decimal com vírgula
const NUMERO_PONTO_MILHAR = /^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/;
// 3) Divergente, com ponto decimal: "4.5", "7.80", "0.450". Só é testada
//    depois da regra 2, então "5.000" já foi lido como milhar.
//    \d+\.\d+   dígitos, um ponto, dígitos
const NUMERO_PONTO_DECIMAL = /^\d+\.\d+$/;

/**
 * Converte um número impresso em laudo brasileiro para Number.
 * Não usa parseFloat direto: parseFloat("13,8") devolve 13 e
 * parseFloat("1.234,5") devolve 1.234, sem avisar do erro.
 * @param {string} texto ex.: "1.234,5"
 * @returns {number|null} null se o texto não for um número reconhecido
 */
export function converterNumeroBR(texto) {
  if (typeof texto !== 'string') return null;
  const limpo = texto.trim();

  if (NUMERO_VIRGULA_DECIMAL.test(limpo)) {
    return Number(limpo.replace(',', '.'));
  }
  if (NUMERO_PONTO_MILHAR.test(limpo)) {
    // Tira todos os pontos (/\./g: o "g" troca todas as ocorrências, não só a
    // primeira) e depois troca a vírgula pelo ponto que o JavaScript entende.
    return Number(limpo.replace(/\./g, '').replace(',', '.'));
  }
  if (NUMERO_PONTO_DECIMAL.test(limpo)) {
    return Number(limpo);
  }
  return null;
}

// --- Faixa de referência ---------------------------------------------------

// Candidato a número dentro da faixa: começa com dígito e segue com dígitos,
// pontos ou vírgulas ("70", "0,45", "1.234,5"). Quem decide se é um número
// válido é converterNumeroBR; esta parte só recorta o pedaço do texto.
const NUM = String.raw`(\d[\d.,]*)`;

// Rótulo no começo: "Desejável: ", "Valor de referência: ".
//   ^            começo do texto
//   [^\d:<>=]+   um ou mais caracteres que NÃO são dígito, ":", "<", ">" ou "="
//                (o ^ dentro de [...] significa "nenhum destes")
//   :\s*         os dois-pontos e os espaços depois deles
const ROTULO_INICIAL = /^[^\d:<>=]+:\s*/;

// Formatos reconhecidos. Todos com ^...$ (o texto inteiro precisa casar) e
// com a flag "i" (ignora maiúsculas: "ATÉ", "Até" e "até" casam).
// "Fronteiras" seguem o sentido literal do texto (backend/src/pipeline/CLAUDE.md).
const FORMATOS_FAIXA = [
  {
    // "70 a 99", "70 - 99", "70-99", "70 – 99", "de 70 a 99", "70 até 99".
    //   (?:de\s+)?          opcional: "de " no começo ((?:...) agrupa sem capturar)
    //   NUM                 1º número (capturado)
    //   (?:\s*[-–—]\s*      separador hífen, meia-risca ou travessão,
    //    |\s+(?:a|até)\s+)  OU a palavra "a"/"até" entre espaços
    //   NUM                 2º número (capturado)
    regex: new RegExp(String.raw`^(?:de\s+)?${NUM}(?:\s*[-–—]\s*|\s+(?:a|até)\s+)${NUM}$`, 'i'),
    montar: ([min, max]) => ({ minimo: min, maximo: max, minimo_inclusivo: true, maximo_inclusivo: true }),
  },
  {
    // "< 200", "Inferior a 190", "Menor que 5", "Abaixo de 5": o limite fica de fora.
    regex: new RegExp(String.raw`^(?:<|inferior\s+a|menor\s+que|abaixo\s+de)\s*${NUM}$`, 'i'),
    montar: ([max]) => ({ minimo: null, maximo: max, minimo_inclusivo: null, maximo_inclusivo: false }),
  },
  {
    // "<= 150", "≤ 150", "Até 150", "Menor ou igual a 150", "Igual ou inferior a 150":
    // o limite está dentro.
    regex: new RegExp(String.raw`^(?:<=|≤|até|(?:menor|inferior)\s+ou\s+igual\s+a|igual\s+ou\s+(?:inferior\s+a|menor\s+que))\s*${NUM}$`, 'i'),
    montar: ([max]) => ({ minimo: null, maximo: max, minimo_inclusivo: null, maximo_inclusivo: true }),
  },
  {
    // "> 40", "Superior a 40", "Maior que 40", "Acima de 40": o limite fica de fora.
    regex: new RegExp(String.raw`^(?:>|superior\s+a|maior\s+que|acima\s+de)\s*${NUM}$`, 'i'),
    montar: ([min]) => ({ minimo: min, maximo: null, minimo_inclusivo: false, maximo_inclusivo: null }),
  },
  {
    // ">= 40", "≥ 40", "Maior ou igual a 40", "Igual ou superior a 126" (Tabela 1
    // do artigo): o limite está dentro.
    regex: new RegExp(String.raw`^(?:>=|≥|(?:maior|superior)\s+ou\s+igual\s+a|igual\s+ou\s+(?:superior\s+a|maior\s+que))\s*${NUM}$`, 'i'),
    montar: ([min]) => ({ minimo: min, maximo: null, minimo_inclusivo: true, maximo_inclusivo: null }),
  },
];

/**
 * Interpreta a faixa de referência como impressa no laudo.
 * Formato não reconhecido → interpretada: false e limites null (nunca chuta).
 * @param {string} texto ex.: "70 a 99", "Inferior a 190 mg/dL", "Desejável: < 200"
 * @param {{ unidade?: string|null }} [opcoes] unidade do resultado. Se a faixa
 *   terminar com ela (Layout B: "70 a 99 mg/dL"), ela é ignorada. Nenhuma outra
 *   palavra é tirada: "200 a 239 limítrofe" não é interpretada.
 * @returns {{ minimo: number|null, maximo: number|null,
 *   minimo_inclusivo: boolean|null, maximo_inclusivo: boolean|null,
 *   interpretada: boolean, texto_original: string }}
 */
export function interpretarFaixa(texto, { unidade } = {}) {
  // Guardamos o texto como veio, só juntando espaços repetidos.
  const textoOriginal = typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim() : '';
  let nucleo = textoOriginal.replace(ROTULO_INICIAL, '');
  if (unidade && nucleo.endsWith(` ${unidade}`)) {
    nucleo = nucleo.slice(0, -(unidade.length + 1));
  }

  for (const formato of FORMATOS_FAIXA) {
    const encontrado = formato.regex.exec(nucleo);
    if (!encontrado) continue;

    // encontrado[0] é o texto todo; [1], [2]... são os grupos capturados (NUM).
    const numeros = encontrado.slice(1).map(converterNumeroBR);
    if (numeros.includes(null)) break; // casou o formato, mas o número é inválido

    const faixa = formato.montar(numeros);
    if (faixa.minimo !== null && faixa.maximo !== null && faixa.minimo > faixa.maximo) {
      break; // "99 a 70": invertida, não confiamos
    }
    return { ...faixa, interpretada: true, texto_original: textoOriginal };
  }

  return {
    minimo: null,
    maximo: null,
    minimo_inclusivo: null,
    maximo_inclusivo: null,
    interpretada: false,
    texto_original: textoOriginal,
  };
}

// --- Linhas do laudo -------------------------------------------------------

// Valor do resultado: sinal opcional ("<", "<=", ">") e o número.
//   ([<>≤≥]=?\s*)?   grupo opcional com o sinal (ex.: "< " em "< 0,5")
//   (\d[\d.,]*)      o número, recortado como em NUM
const VALOR = String.raw`([<>≤≥]=?\s*)?(\d[\d.,]*)`;

// Layout A: "Glicose em jejum 118 mg/dL 70 a 99" (o pdf-parse junta as colunas
// com um espaço só, então quem separa o nome do valor é o primeiro número).
//   ^(\p{L}[\p{L}\s().,-]*?)  nome: começa com letra e só tem letras, espaços e
//                             ( ) . , -  (sem dígitos: "T4 livre" não cabe).
//                             \p{L} é "qualquer letra", inclusive acentuada;
//                             o "*?" pega o MENOR nome possível, que para no valor
//   \s+                       espaço
//   VALOR                     sinal (grupo 2) e número (grupo 3)
//   (?:\s+(.*))?$             opcional: o resto da linha (grupo 4)
// Flag "u" (Unicode): necessária para o \p{L}.
const LINHA_TABELA = new RegExp(String.raw`^(\p{L}[\p{L}\s().,-]*?)\s+${VALOR}(?:\s+(.*))?$`, 'u');

// Linha que começa no valor, sem nome: "118 mg/dL 70 a 99" (nome quebrado na
// linha de cima).
const LINHA_SEM_NOME = new RegExp(String.raw`^${VALOR}(?:\s+(.*))?$`);

// Layout B: "Resultado: 118 mg/dL". O nome está acima e a faixa, na linha abaixo.
const ROTULO_RESULTADO = /^resultados?\s*:/i;
const LINHA_RESULTADO = new RegExp(String.raw`^resultados?\s*:\s*${VALOR}(?:\s+(.*))?$`, 'i');
// "Valor de referência: 70 a 99 mg/dL", "Valores de referência: ...", "Referência: ...".
const LINHA_REFERENCIA = /^(?:valor(?:es)?\s+de\s+)?refer[êe]ncias?\s*:\s*(.*)$/i;
// Rótulo da categoria "normal" quando o laudo traz várias faixas, uma por linha
// (Tabela 1 do artigo: "Normal: inferior a 100 mg/dL", "Glicemia de jejum
// alterada: 100 a 125 mg/dL", "Diabetes: igual ou superior a 126 mg/dL").
const ROTULO_FAIXA_NORMAL = /^(?:normal|desej[áa]vel|[óo]timo|adequado)\s*:/i;

// Quantas linhas acima do resultado procurar o nome (Layout B: nome, Material, Resultado).
const LINHAS_ACIMA_PARA_O_NOME = 3;

// Heurísticas de "parece resultado", usadas só para linhas que não foram
// interpretadas: decidem se vão para nao_interpretadas ou são ignoradas
// (cabeçalho, rodapé). Testadas contra os cabeçalhos dos laudos sintéticos.
const PARECE_RESULTADO = [
  // número seguido de unidade com "/": "8 mg/dL", "88mg/dL".
  // [^\s\d/:]+ = letras da unidade antes da "/"; datas ("20/10") não casam
  // porque ali não há nada entre o dígito e a "/".
  /\d\s*[^\s\d/:]+\//,
  /\d\s*%/,
  // intervalo: "70 a 99", "70 - 99" (com espaços: o "0000-0000" do telefone e
  // o CPF não casam), "70–99".
  /\d\s+(?:a|até)\s+\d/i,
  /\d\s+[-–—]\s+\d/,
  /\d[–—]\d/,
  // comparador seguido de número: "< 200", "Inferior a 190", "Até 150".
  /(?:[<>≤≥]|\b(?:inferior|superior)\s+a|\b(?:menor|maior)\s+que|\bat[ée])\s*\d/i,
];

// Campos que contam para a confiança do analito: nome, valor, unidade e faixa.
const CAMPOS_DO_ANALITO = 4;

/**
 * Transforma o texto do laudo (saída de extrairTextoPdf) em analitos.
 * Não classifica e não normaliza o nome: só lê o que está impresso.
 * @param {string} texto texto bruto do laudo. Contém dados do paciente.
 * @returns {{ analitos: object[], nao_interpretadas: { linha: string, motivo: string }[] }}
 *   nao_interpretadas guarda linhas do laudo: mesma regra do texto bruto
 *   (nunca para log, front ou modelo).
 */
export function estruturarAnalitos(texto) {
  // Tabs e espaços repetidos viram um espaço. Linhas vazias ficam no array
  // (como "") para os índices continuarem batendo com o texto.
  const linhas = (typeof texto === 'string' ? texto : '')
    .split('\n')
    .map((linha) => linha.replace(/\s+/g, ' ').trim());

  const analitos = [];
  const naoInterpretadas = [];
  // Índices das linhas já usadas por um analito (nome ou faixa do Layout B),
  // para não serem lidas de novo.
  const usadas = new Set();

  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] === '' || usadas.has(i)) continue;
    const lida = lerLinha(linhas, i, usadas);
    if (lida.analito) {
      analitos.push(lida.analito);
    } else if (lida.motivo) {
      naoInterpretadas.push({ linha: linhas[i], motivo: lida.motivo });
    }
    // sem analito e sem motivo: cabeçalho/rodapé, ignorado.
  }

  return { analitos, nao_interpretadas: naoInterpretadas };
}

// Devolve { analito }, { motivo } (vai para nao_interpretadas) ou {} (ignorada).
function lerLinha(linhas, i, usadas) {
  const linha = linhas[i];

  // 1) Layout B: "Resultado: 118 mg/dL".
  if (ROTULO_RESULTADO.test(linha)) {
    const encontrado = LINHA_RESULTADO.exec(linha);
    if (!encontrado) return { motivo: 'valor_ausente' };
    const [, sinal, numero, resto] = encontrado;
    const { unidade, textoFaixa } = separarUnidadeEFaixa(resto);
    const abaixo = textoFaixa
      ? { textoFaixa, outrasFaixas: [], indices: [] }
      : lerFaixaAbaixo(linhas, i, unidade);
    const campos = { sinal, numero, unidade, textoFaixa: abaixo.textoFaixa, outrasFaixas: abaixo.outrasFaixas };
    return montarComNomeAcima(linhas, i, usadas, campos, abaixo.indices);
  }

  // 2) Layout A: "Nome valor unidade faixa".
  const tabela = LINHA_TABELA.exec(linha);
  if (tabela) {
    const [, nome, sinal, numero, resto] = tabela;
    // "Glicose em jejum 88": nome e valor, nada depois. Não dá para confiar,
    // mas também não pode sumir em silêncio.
    if (!resto) return { motivo: 'unidade_e_faixa_ausentes' };
    const { unidade, textoFaixa } = separarUnidadeEFaixa(resto);
    if (temFormaDeResultado(unidade, textoFaixa)) {
      return montarAnalito({ nome, sinal, numero, unidade, textoFaixa });
    }
  }

  // 3) Linha que começa no valor: o nome ficou na linha de cima.
  const semNome = LINHA_SEM_NOME.exec(linha);
  if (semNome) {
    const [, sinal, numero, resto] = semNome;
    const { unidade, textoFaixa } = separarUnidadeEFaixa(resto);
    if (temFormaDeResultado(unidade, textoFaixa)) {
      return montarComNomeAcima(linhas, i, usadas, { sinal, numero, unidade, textoFaixa }, []);
    }
  }

  // 4) Não interpretada: só é registrada se parecer resultado.
  if (PARECE_RESULTADO.some((regex) => regex.test(linha))) {
    return { motivo: 'formato_nao_reconhecido' };
  }
  return {};
}

// O primeiro token depois do valor é a unidade se parecer unidade; o resto é a
// faixa. Sem unidade reconhecível, tudo é tratado como faixa.
function separarUnidadeEFaixa(resto) {
  if (!resto) return { unidade: null, textoFaixa: '' };
  const [primeiro, ...demais] = resto.split(' ');
  if (pareceUnidade(primeiro)) {
    return { unidade: primeiro, textoFaixa: demais.join(' ') };
  }
  return { unidade: null, textoFaixa: resto };
}

// Unidade: um token que não começa com dígito e tem "/" ou "%"
// (mg/dL, g/dL, µUI/mL, /mm³, %). Unidades sem "/" nem "%" (fL, pg) não são
// reconhecidas: limite conhecido, fora dos exames do protótipo.
function pareceUnidade(token) {
  return /^[^\d\s]\S*$/.test(token) && /[/%]/.test(token);
}

// "Página 1 de 1" tem nome e número, mas nem unidade nem faixa: não é resultado.
function temFormaDeResultado(unidade, textoFaixa) {
  return unidade !== null || interpretarFaixa(textoFaixa).interpretada;
}

// Layout B: a faixa nas linhas abaixo do "Resultado:".
// - "Valor de referência: 70 a 99 mg/dL": faixa na mesma linha do rótulo.
// - "Valores de referência:" sozinho, seguido de uma categoria por linha
//   ("Rótulo: faixa"): usa a de rótulo "Normal" (como a Tabela 2 do artigo) e
//   guarda as outras em outrasFaixas. Sem exatamente uma "Normal", não escolhe:
//   junta todas no texto e a faixa fica não interpretada.
// Devolve também os índices das linhas lidas, para não serem lidas de novo.
function lerFaixaAbaixo(linhas, i, unidade) {
  const referencia = LINHA_REFERENCIA.exec(linhas[i + 1] ?? '');
  if (!referencia) return { textoFaixa: '', outrasFaixas: [], indices: [] };
  if (referencia[1]) return { textoFaixa: referencia[1], outrasFaixas: [], indices: [i + 1] };

  const categorias = [];
  const indices = [i + 1];
  for (let j = i + 2; j < linhas.length; j++) {
    const linha = linhas[j];
    if (!linha.includes(':') || !interpretarFaixa(linha, { unidade }).interpretada) break;
    categorias.push(linha);
    indices.push(j);
  }
  const normais = categorias.filter((categoria) => ROTULO_FAIXA_NORMAL.test(categoria));
  if (normais.length !== 1) {
    return { textoFaixa: categorias.join('; '), outrasFaixas: [], indices };
  }
  return {
    textoFaixa: normais[0],
    outrasFaixas: categorias.filter((categoria) => categoria !== normais[0]),
    indices,
  };
}

// Procura o nome nas linhas acima: pula linhas "Rótulo: ..." (ex.: "Material:")
// e para em linha com número, linha já usada ou depois de LINHAS_ACIMA_PARA_O_NOME.
function montarComNomeAcima(linhas, i, usadas, campos, indicesDaFaixa) {
  let indiceNome = null;
  let olhadas = 0;
  for (let j = i - 1; j >= 0 && olhadas < LINHAS_ACIMA_PARA_O_NOME; j--) {
    const acima = linhas[j];
    if (acima === '') continue;
    olhadas++;
    if (usadas.has(j) || /\d/.test(acima)) break;
    if (acima.includes(':')) continue;
    if (/\p{L}/u.test(acima)) indiceNome = j;
    break;
  }
  if (indiceNome === null) return { motivo: 'nome_nao_encontrado' };

  const lido = montarAnalito({ nome: linhas[indiceNome], ...campos });
  if (lido.analito) {
    usadas.add(indiceNome);
    for (const indice of indicesDaFaixa) usadas.add(indice);
  }
  return lido;
}

function montarAnalito({ nome, sinal, numero, unidade, textoFaixa, outrasFaixas = [] }) {
  // "< 0,5" (abaixo do limite de detecção) não é o mesmo que o valor 0,5:
  // não inventamos um número; a linha fica registrada para a decisão de confiança.
  if (sinal) return { motivo: 'valor_com_sinal' };
  const valor = converterNumeroBR(numero);
  if (valor === null) return { motivo: 'valor_invalido' };

  const faixa = interpretarFaixa(textoFaixa, { unidade });
  const pendencias = [];
  if (!unidade) pendencias.push('unidade_ausente');
  if (!faixa.texto_original) pendencias.push('faixa_ausente');
  else if (!faixa.interpretada) pendencias.push('faixa_nao_interpretada');

  // Nome e valor sempre existem aqui; unidade e faixa podem faltar.
  const camposEncontrados = 2 + (unidade ? 1 : 0) + (faixa.interpretada ? 1 : 0);
  return {
    analito: {
      nome_no_laudo: nome.trim(),
      valor,
      valor_impresso: numero,
      unidade,
      faixa_referencia: faixa,
      // Outras categorias impressas (ex.: "Diabetes: igual ou superior a 126
      // mg/dL"), como texto. Não entram na classificação; ficam para auditoria.
      outras_faixas: outrasFaixas,
      confianca: camposEncontrados / CAMPOS_DO_ANALITO,
      pendencias,
    },
  };
}
