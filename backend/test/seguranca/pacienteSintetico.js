// Paciente FICTÍCIO com identificadores plantados, em formatos realistas, para
// os testes da BWL-07. Nenhum dado aqui pertence a uma pessoa real: os números
// seguem só o FORMATO (CPF 123.456.789-09 é o exemplo clássico de documentação).
import { semAcento } from '../../src/seguranca/pseudonimizar.js';

export const LAUDO_SINTETICO = [
  'Laboratório Modelo Lumie (fictício)',
  'LAUDO DE EXAMES LABORATORIAIS',
  'Paciente: Lúcia Fictícia Andrade Teste Pedido nº: PED-2026-0042',
  'Sexo: Feminino Idade: 38 anos',
  'Nascimento: 05/07/1988 CPF: 123.456.789-09',
  'RG: 12.345.678-9 Prontuário: PR-778899',
  'Médico solicitante: Dra. Helena Modelo Fictícia - CRM: SP 123456',
  'Coleta: 20/10/2026 07:40 Liberação: 21/10/2026 15:10',
  'Exame Resultado Unidade Valores de referência',
  'Glicose em jejum 118 mg/dL 70 a 99',
  'Creatinina 0,9 mg/dL 0,6 a 1,3',
  'Responsável técnico: Dr. Otávio Exemplo (fictício) - registro FICTÍCIO',
].join('\n');

// O que a paciente digita no chat: o próprio nome (sem acento, minúsculo), o
// CPF sem pontuação, a data por extenso, telefone, e-mail e o protocolo.
export const MENSAGEM_COM_IDENTIFICADORES = 'Oi, meu nome é lucia ficticia andrade teste, CPF 12345678909. '
  + 'Nasci em 5 de julho de 1988 (05-07-1988). Meu telefone é (13) 99876-5432 e meu e-mail é lucia.andrade@exemplo.com. '
  + 'O protocolo é PED-2026-0042 e a Dra. HELENA MODELO pediu, CRM-SP 123456. Minha glicose deu 118, é ruim?';

// Tudo que NÃO pode chegar à IA, em todas as grafias que o teste procura.
export const PROIBIDOS = [
  'Lúcia Fictícia Andrade Teste', 'Lúcia', 'Fictícia', 'Andrade',
  '123.456.789-09', '12.345.678-9', '05/07/1988', '5 de julho de 1988',
  'PED-2026-0042', 'PR-778899', 'Helena Modelo Fictícia', 'Helena', 'Otávio',
  'SP 123456', '(13) 99876-5432', 'lucia.andrade@exemplo.com',
];

/**
 * Detector: procura cada identificador PROIBIDO no texto, em variantes
 * (com/sem acento, qualquer caixa e, se tiver 4+ dígitos, só os dígitos).
 * @returns {string[]} os que foram ENCONTRADOS (o esperado é [])
 */
export function encontrarIdentificadores(texto, proibidos = PROIBIDOS) {
  const normal = semAcento(texto).toLowerCase();
  const soDigitosEPalavras = normal.replace(/[.\-/\s()]/g, '');
  return proibidos.filter((valor) => {
    const alvo = semAcento(valor).toLowerCase();
    if (new RegExp(`(?<![a-z0-9])${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(normal)) return true;
    const digitos = alvo.replace(/\D/g, '');
    return digitos.length >= 4 && soDigitosEPalavras.includes(digitos);
  });
}
