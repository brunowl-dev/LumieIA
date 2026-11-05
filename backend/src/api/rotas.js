// Rotas HTTP e orquestração (BWL-09, contrato §5 a §7).
// Sem framework (só node:http) e sem dependência nova: o upload multipart é lido
// com o Response.formData() que já vem no Node.
//
// Esta pasta não tem regra de negócio: classificação vem do pipeline, verificação
// e mensagem padrão da segurança, texto da IA. Aqui só se ligam as peças,
// decide-se a cor (§5.1) e traduzem-se os erros (§7).
import { readFileSync } from 'node:fs';
import { processarLaudoImagem, processarLaudoPdf, MENSAGEM_ARQUIVO_ILEGIVEL } from '../pipeline/processarLaudo.js';
import { CODIGOS_ERRO } from '../pipeline/extrairTextoPdf.js';
import { CODIGOS_ERRO_OCR } from '../pipeline/extrairTextoImagem.js';
import { gerarComSeguranca } from './gerarComSeguranca.js';
import { verificarChat, verificarExplicacao, PARTES_EXPLICACAO } from '../seguranca/verificarResposta.js';
import { montarChatPadrao, montarExplicacaoPadrao } from '../seguranca/mensagemPadrao.js';
import { pseudonimizarTexto } from '../seguranca/pseudonimizar.js';
import { registrarEvento as registrarPadrao } from '../seguranca/registrarEvento.js';

// --- Erros (contrato §7) ---------------------------------------------------------

const ERROS = {
  FORMATO_NAO_SUPORTADO: [415, 'Formato de arquivo não suportado. Envie o laudo em PDF ou uma foto (JPG ou PNG).'],
  ARQUIVO_MUITO_GRANDE: [413, null], // mensagem com o limite, montada na hora
  ARQUIVO_ILEGIVEL: [422, MENSAGEM_ARQUIVO_ILEGIVEL],
  BAIXA_CONFIANCA: [422, null], // mensagem vem do pipeline (confianca.js)
  EXAME_NAO_ENCONTRADO: [404, 'Não encontramos este exame no seu laudo. Volte à tela de exames.'],
  MODELO_INDISPONIVEL: [503, 'Estamos indisponíveis no momento. Tente de novo em alguns minutos.'],
  SESSAO_EXPIRADA: [410, 'Sua sessão expirou. Envie o laudo de novo.'],
  // Técnicos (não aparecem para o paciente se o front estiver certo):
  REQUISICAO_INVALIDA: [400, 'Não entendemos o pedido. Recarregue a página e tente de novo.'],
  ROTA_NAO_ENCONTRADA: [404, 'Endereço não encontrado.'],
  ERRO_INTERNO: [500, 'Algo deu errado do nosso lado. Tente de novo.'],
};

class ErroHttp extends Error {
  constructor(codigo, motivo, mensagemUsuario) {
    super(codigo);
    this.codigo = codigo;
    this.motivo = motivo;
    this.mensagemUsuario = mensagemUsuario ?? ERROS[codigo][1];
  }
}

// Erros internos da extração do PDF (§2.1) e do OCR → erros do contrato.
const TRADUCAO_EXTRACAO = {
  [CODIGOS_ERRO.ARQUIVO_VAZIO]: ['ARQUIVO_ILEGIVEL', 'arquivo_vazio'],
  [CODIGOS_ERRO.PDF_CORROMPIDO]: ['ARQUIVO_ILEGIVEL', 'pdf_corrompido'],
  [CODIGOS_ERRO.ARQUIVO_NAO_E_PDF]: ['FORMATO_NAO_SUPORTADO', 'arquivo_nao_e_pdf'],
  // [A CONFIRMAR no grupo] pedir a senha; por enquanto pede um PDF sem senha.
  [CODIGOS_ERRO.PDF_PROTEGIDO]: ['ARQUIVO_ILEGIVEL', 'pdf_protegido', 'Este PDF está protegido por senha. Envie uma versão sem senha.'],
  [CODIGOS_ERRO.SENHA_INCORRETA]: ['ARQUIVO_ILEGIVEL', 'pdf_protegido', 'Este PDF está protegido por senha. Envie uma versão sem senha.'],
  [CODIGOS_ERRO_OCR.IMAGEM_INVALIDA]: ['ARQUIVO_ILEGIVEL', 'imagem_invalida'],
};

// --- Base de conhecimento ----------------------------------------------------------

/** Fichas da base por id_canonico. Falha alto se o arquivo estiver malformado. */
export function carregarFichas(caminho) {
  const base = JSON.parse(readFileSync(caminho, 'utf8'));
  if (!Array.isArray(base.exames)) throw new Error(`Base de conhecimento sem a lista "exames": ${caminho}`);
  const fichas = new Map();
  for (const ficha of base.exames) {
    for (const campo of ['id_canonico', 'o_que_avalia', 'especialidade', 'status']) {
      if (typeof ficha[campo] !== 'string' || !ficha[campo].trim()) {
        throw new Error(`Ficha ${ficha.id_canonico ?? '?'} sem o campo "${campo}" (${caminho})`);
      }
    }
    fichas.set(ficha.id_canonico, ficha);
  }
  return fichas;
}

// Só ficha "pronto" tem explicação (contrato §3).
const fichaPronta = (fichas, id) => (id && fichas.get(id)?.status === 'pronto' ? fichas.get(id) : null);

// --- Cores (contrato §5.1) ---------------------------------------------------------

export function corDoItem({ classificacao, alerta_critico: alerta }) {
  if (alerta) return 'vermelho';
  return classificacao === 'dentro' ? 'verde' : 'amarelo';
}

// --- Leitura do corpo ----------------------------------------------------------------

// Lê o corpo até `limite` bytes. Passou → ARQUIVO_MUITO_GRANDE, sem guardar o resto.
async function lerCorpo(req, limite, codigoSeGrande = 'ARQUIVO_MUITO_GRANDE', mensagemSeGrande) {
  if (Number(req.headers['content-length']) > limite) {
    req.resume(); // descarta o que falta, para a resposta chegar ao navegador
    throw new ErroHttp(codigoSeGrande, 'acima_do_limite', mensagemSeGrande);
  }
  // Sem content-length: lê tudo, mas para de GUARDAR ao passar do limite.
  // (Lançar o erro no meio da leitura fecharia a conexão antes da resposta.)
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total <= limite) partes.push(parte);
  }
  if (total > limite) throw new ErroHttp(codigoSeGrande, 'acima_do_limite', mensagemSeGrande);
  return Buffer.concat(partes);
}

async function lerJson(req) {
  const corpo = await lerCorpo(req, 64 * 1024, 'REQUISICAO_INVALIDA');
  try {
    const dados = JSON.parse(corpo.toString('utf8'));
    if (dados && typeof dados === 'object') return dados;
  } catch { /* cai no erro abaixo */ }
  throw new ErroHttp('REQUISICAO_INVALIDA', 'json_invalido');
}

const ehTextoPreenchido = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// Tipo pelo CONTEÚDO (assinatura dos primeiros bytes), não pelo nome do arquivo.
function tipoDoArquivo(bytes) {
  if (bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) return 'pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'imagem'; // JPEG
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'imagem'; // PNG
  return 'outro';
}

// --- Aplicação ---------------------------------------------------------------------------

/**
 * Cria o tratador de requisições. Tudo é injetado (testes usam IA falsa, relógio e log de teste).
 * @param {object} d
 * @param {ReturnType<import('./sessao.js').criarSessoes>} d.sessoes
 * @param {ReturnType<import('./adaptadorIa.js').criarAdaptadorIa>} d.adaptador
 * @param {Map<string, object>} d.fichas
 * @param {number} d.maxRegeneracoes
 * @param {number} d.uploadMaxMb
 * @param {Function} [d.processarPdf]
 * @param {Function} [d.processarImagem]
 * @param {Function} [d.registrar]
 */
export function criarApp({
  sessoes, adaptador, fichas, maxRegeneracoes, uploadMaxMb,
  processarPdf = processarLaudoPdf, processarImagem = processarLaudoImagem, registrar = registrarPadrao,
}) {
  // --- Porta 1: enviar laudo (momento 1, SEM IA) ---
  async function enviarLaudo(req) {
    if (!String(req.headers['content-type']).startsWith('multipart/form-data')) {
      throw new ErroHttp('FORMATO_NAO_SUPORTADO', 'nao_e_multipart');
    }
    const corpo = await lerCorpo(req, uploadMaxMb * 1024 * 1024, 'ARQUIVO_MUITO_GRANDE',
      `O arquivo passa de ${uploadMaxMb} MB. Envie um arquivo menor.`);
    let formulario;
    try {
      formulario = await new Response(corpo, { headers: { 'content-type': req.headers['content-type'] } }).formData();
    } catch {
      throw new ErroHttp('REQUISICAO_INVALIDA', 'multipart_invalido');
    }
    // Campo "arquivo" (ou o primeiro arquivo do formulário).
    const arquivo = [formulario.get('arquivo'), ...formulario.values()].find((v) => v && typeof v === 'object' && 'arrayBuffer' in v);
    if (!arquivo) throw new ErroHttp('FORMATO_NAO_SUPORTADO', 'sem_arquivo');
    // O arquivo fica só em memória (Buffer): nada é gravado em disco.
    const bytes = Buffer.from(await arquivo.arrayBuffer());

    const tipo = tipoDoArquivo(bytes);
    if (tipo === 'outro') throw new ErroHttp(bytes.length === 0 ? 'ARQUIVO_ILEGIVEL' : 'FORMATO_NAO_SUPORTADO', bytes.length === 0 ? 'arquivo_vazio' : 'formato_desconhecido');

    // Foto → OCR (BWL-10). PDF → texto; se for digitalizado, o pipeline faz OCR das páginas.
    let resultado;
    try {
      resultado = tipo === 'imagem' ? await processarImagem(bytes) : await processarPdf(bytes);
    } catch (erro) {
      const traducao = TRADUCAO_EXTRACAO[erro.codigo];
      if (!traducao) throw erro;
      throw new ErroHttp(...traducao);
    }
    if (resultado.status === 'erro') {
      const { codigo, motivo, mensagem_usuario: mensagem } = resultado.erro;
      throw new ErroHttp(codigo, motivo, mensagem);
    }

    const { laudo, identificadores } = resultado;
    sessoes.criar({ laudo, identificadores }); // identificadores: SÓ na sessão
    registrar('LAUDO_PROCESSADO', { origem: laudo.origem, analitos: laudo.analitos.length, itens_nao_lidos: laudo.itens_nao_lidos.length });
    return [200, {
      status: 'ok',
      id_laudo: laudo.id_laudo,
      itens: laudo.analitos.map((a) => ({
        id_canonico: a.id_canonico,
        nome: a.nome_no_laudo,
        valor: a.valor,
        unidade: a.unidade,
        faixa_referencia: a.faixa_referencia,
        classificacao: a.classificacao,
        cor: corDoItem(a),
        alerta_prioritario: a.alerta_critico,
        explicacao_disponivel: fichaPronta(fichas, a.id_canonico) !== null,
      })),
      // Caso misto (§2.4): o que não foi lido aparece só pelo nome, sem valor.
      itens_nao_lidos: laudo.itens_nao_lidos.map((i) => ({ nome: i.nome_no_laudo })),
      // Resultados descritivos (§5.1): sem cor nem explicação, só a comparação com a referência.
      itens_descritivos: laudo.itens_descritivos.map((d) => ({
        nome: d.nome_no_laudo, resultado: d.resultado, referencia: d.referencia, situacao: d.situacao,
      })),
      aviso_usuario: laudo.aviso_usuario,
    }];
  }

  // Sessão + analito + ficha de um pedido das portas 2 e 3.
  function localizarExame(dados) {
    if (!ehTextoPreenchido(dados.id_laudo) || !ehTextoPreenchido(dados.id_canonico)) {
      throw new ErroHttp('REQUISICAO_INVALIDA', 'campos_obrigatorios');
    }
    const sessao = sessoes.obter(dados.id_laudo);
    if (!sessao) throw new ErroHttp('SESSAO_EXPIRADA');
    const analito = sessao.laudo.analitos.find((a) => a.id_canonico === dados.id_canonico);
    const ficha = fichaPronta(fichas, dados.id_canonico);
    if (!analito || !ficha) throw new ErroHttp('EXAME_NAO_ENCONTRADO');
    return { sessao, analito, ficha };
  }

  const aoReprovar = (idCanonico) => (tentativa, motivos) => registrar('RESPOSTA_REPROVADA', { id_canonico: idCanonico, tentativa, motivos });

  // --- Porta 2: explicar exame (momento 2) ---
  async function explicar(req) {
    const { sessao, analito, ficha } = localizarExame(await lerJson(req));
    const r = await gerarComSeguranca({
      gerar: (motivos) => adaptador.gerarExplicacao({ sessao, analito, ficha, motivosReprovacao: motivos }),
      verificar: (resposta) => verificarExplicacao(resposta, analito, ficha),
      mensagemPadrao: () => montarExplicacaoPadrao(analito, ficha),
      maxRegeneracoes,
      aoReprovar: aoReprovar(analito.id_canonico),
    });
    // Só as 5 partes saem (campos extras do modelo ficam de fora).
    const explicacao = Object.fromEntries(PARTES_EXPLICACAO.map((p) => [p, r.conteudo[p]]));
    // A explicação é a 1ª mensagem do chat daquele exame (reabrir recomeça a conversa).
    sessao.chats.set(analito.id_canonico, [{ papel: 'assistente', texto: PARTES_EXPLICACAO.map((p) => explicacao[p]).join('\n') }]);
    registrar('EXPLICACAO_ENTREGUE', { id_canonico: analito.id_canonico, origem_texto: r.origem_texto, tentativas_regeneracao: r.tentativas_regeneracao });
    return [200, {
      status: 'ok',
      id_laudo: sessao.id_laudo,
      id_canonico: analito.id_canonico,
      explicacao,
      origem_texto: r.origem_texto,
      tentativas_regeneracao: r.tentativas_regeneracao,
    }];
  }

  // --- Porta 3: chat do exame (momento 3) ---
  async function conversar(req) {
    const dados = await lerJson(req);
    if (!ehTextoPreenchido(dados.mensagem, 1000)) throw new ErroHttp('REQUISICAO_INVALIDA', 'mensagem_invalida');
    const { sessao, analito, ficha } = localizarExame(dados);
    const historico = sessoes.historico(sessao, analito.id_canonico);
    const r = await gerarComSeguranca({
      gerar: (motivos) => adaptador.responderChat({ sessao, analito, ficha, mensagem: dados.mensagem, historico, motivosReprovacao: motivos }),
      verificar: (resposta) => verificarChat(resposta, ficha),
      mensagemPadrao: () => montarChatPadrao(ficha),
      maxRegeneracoes,
      aoReprovar: aoReprovar(analito.id_canonico),
    });
    // O histórico guarda a mensagem JÁ pseudonimizada (o nome não fica nem aqui).
    const limpa = pseudonimizarTexto(dados.mensagem, sessao.identificadores, sessao.mapa);
    sessao.mapa = limpa.mapa;
    historico.push({ papel: 'paciente', texto: limpa.texto }, { papel: 'assistente', texto: r.conteudo.resposta });
    registrar('CHAT_RESPONDIDO', { id_canonico: analito.id_canonico, origem_texto: r.origem_texto, tentativas_regeneracao: r.tentativas_regeneracao });
    return [200, { status: 'ok', resposta: r.conteudo.resposta, origem_texto: r.origem_texto }];
  }

  const ROTAS = {
    'GET /api/saude': async () => [200, { status: 'ok' }],
    'GET /api': async () => [200, { projeto: 'Lumie', modulo: 'IA', versao: '0.1.0' }],
    'POST /api/laudos': enviarLaudo,
    'POST /api/explicacoes': explicar,
    'POST /api/chat': conversar,
  };

  return async function tratar(req, res) {
    const caminho = (req.url ?? '').split('?')[0];
    const rota = ROTAS[`${req.method} ${caminho}`];
    let status;
    let corpo;
    try {
      if (!rota) throw new ErroHttp('ROTA_NAO_ENCONTRADA');
      [status, corpo] = await rota(req);
    } catch (erro) {
      const conhecido = erro instanceof ErroHttp ? erro
        : erro?.codigo === 'MODELO_INDISPONIVEL' ? new ErroHttp('MODELO_INDISPONIVEL', erro.motivo)
          : null;
      const final = conhecido ?? new ErroHttp('ERRO_INTERNO');
      if (!conhecido) registrar('ERRO_INTERNO', { rota: caminho.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'raiz' });
      else if (final.codigo === 'MODELO_INDISPONIVEL') registrar('MODELO_INDISPONIVEL', { motivo: final.motivo });
      else registrar('REQUISICAO_RECUSADA', { codigo: final.codigo, motivo: final.motivo ?? 'sem_motivo' });
      status = ERROS[final.codigo]?.[0] ?? 500;
      corpo = { status: 'erro', erro: { codigo: final.codigo, ...(final.motivo ? { motivo: final.motivo } : {}), mensagem_usuario: final.mensagemUsuario } };
    }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(corpo));
  };
}
