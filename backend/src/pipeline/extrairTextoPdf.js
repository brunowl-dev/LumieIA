// Etapa 1 do pipeline (BWL-02): ler o texto de um PDF DIGITAL com pdf-parse.
// Só lê. Não interpreta valores (BWL-03), não faz OCR (BWL-10), não usa o modelo.
// Não grava log: o texto é dado de saúde. Quem chama pode registrar no máximo
// numPaginas, caracteresUteis e o código de erro.
//
// pdf-parse v2 (classe PDFParse, por cima do pdf.js da Mozilla). A v1 era uma
// função e tinha o bug de abrir um PDF de teste interno ao ser importada via ESM;
// a v2 não tem esse código, então o import pela raiz é o correto.
import { PDFParse, PasswordException, VerbosityLevel } from 'pdf-parse';

// Abaixo disso o PDF é tratado como "sem camada de texto" (digitalização = só
// imagem) e, no futuro, vai para o OCR. Os laudos de teste têm ~550 a ~900
// caracteres úteis e um PDF só de imagem tem 0. 50 deixa de fora carimbos que
// alguns scanners escrevem ("Página 1 de 1", nome do aparelho) e fica muito
// abaixo de qualquer laudo real (só o cabeçalho do laboratório já passa disso).
export const LIMIAR_CARACTERES_UTEIS = 50;

// O cabeçalho "%PDF-" deve estar no começo, mas a especificação tolera lixo antes
// dele; leitores como o Acrobat procuram nos primeiros 1024 bytes.
const BYTES_PARA_PROCURAR_CABECALHO = 1024;

// Códigos internos do pipeline. O orquestrador traduz para os códigos do
// contrato (§7) antes de responder ao front.
export const CODIGOS_ERRO = Object.freeze({
  ARQUIVO_VAZIO: 'ARQUIVO_VAZIO',
  ARQUIVO_NAO_E_PDF: 'ARQUIVO_NAO_E_PDF',
  PDF_CORROMPIDO: 'PDF_CORROMPIDO',
  PDF_PROTEGIDO: 'PDF_PROTEGIDO', // tem senha e nenhuma foi informada
  SENHA_INCORRETA: 'SENHA_INCORRETA', // tem senha e a informada não abre
});

// Códigos que o pdf.js põe na exceção de senha (PasswordResponses).
const PDFJS_SENHA_INCORRETA = 2;

export class ErroExtracaoPdf extends Error {
  constructor(codigo, mensagem, opcoes) {
    super(mensagem, opcoes);
    this.name = 'ErroExtracaoPdf';
    this.codigo = codigo;
  }
}

/**
 * Lê o texto de um PDF digital.
 * @param {Buffer|Uint8Array} buffer conteúdo do arquivo
 * @param {{ senha?: string }} [opcoes] senha, se o PDF for protegido. Usada só
 *   para abrir o arquivo; nunca é guardada, registrada ou enviada ao modelo.
 * @returns {Promise<{ texto: string, numPaginas: number, caracteresUteis: number, temCamadaDeTexto: boolean }>}
 * @throws {ErroExtracaoPdf}
 */
export async function extrairTextoPdf(buffer, { senha } = {}) {
  if (!(buffer instanceof Uint8Array)) {
    // Erro de programação (quem chamou passou outra coisa), não do arquivo.
    throw new TypeError('extrairTextoPdf espera um Buffer');
  }
  if (buffer.length === 0) {
    throw new ErroExtracaoPdf(CODIGOS_ERRO.ARQUIVO_VAZIO, 'O arquivo está vazio.');
  }
  if (!temCabecalhoPdf(buffer)) {
    // Um JPG ou bytes aleatórios param aqui, sem chegar ao pdf-parse.
    throw new ErroExtracaoPdf(CODIGOS_ERRO.ARQUIVO_NAO_E_PDF, 'O arquivo não é um PDF.');
  }

  const parser = new PDFParse({
    data: buffer,
    password: senha,
    verbosity: VerbosityLevel.ERRORS, // sem avisos do pdf.js no console
  });
  let resultado;
  try {
    // disableNormalization: sem isso o pdf.js aplica Unicode NFKC e troca, por
    // exemplo, o "µ" (U+00B5) de "µUI/mL" pela letra grega "μ" (U+03BC).
    resultado = await parser.getText({ disableNormalization: true });
  } catch (erro) {
    throw traduzirErroDoParser(erro);
  } finally {
    await parser.destroy();
  }

  // Juntamos as páginas nós mesmos: o resultado.text do pdf-parse inclui um
  // marcador "-- 1 of 1 --" que não existe no PDF.
  const texto = resultado.pages
    .map((pagina) => pagina.text)
    .join('\n')
    .replace(/\r\n?/g, '\n');
  const caracteresUteis = texto.replace(/\s/g, '').length;

  return {
    texto,
    numPaginas: resultado.total,
    caracteresUteis,
    temCamadaDeTexto: caracteresUteis >= LIMIAR_CARACTERES_UTEIS,
  };
}

function temCabecalhoPdf(buffer) {
  const inicio = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.length)
    .subarray(0, BYTES_PARA_PROCURAR_CABECALHO);
  return inicio.includes('%PDF-');
}

function traduzirErroDoParser(erro) {
  if (erro instanceof PasswordException) {
    // O pdf-parse embrulha a exceção do pdf.js; o código original fica em cause.
    return erro.cause?.code === PDFJS_SENHA_INCORRETA
      ? new ErroExtracaoPdf(CODIGOS_ERRO.SENHA_INCORRETA, 'A senha do PDF está incorreta.', { cause: erro })
      : new ErroExtracaoPdf(CODIGOS_ERRO.PDF_PROTEGIDO, 'O PDF é protegido por senha.', { cause: erro });
  }
  return new ErroExtracaoPdf(CODIGOS_ERRO.PDF_CORROMPIDO, 'Não foi possível ler o PDF.', { cause: erro });
}
