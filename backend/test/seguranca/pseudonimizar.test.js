// Pseudonimização da entrada da IA (BWL-07). Rodar: npm test.
// Prova principal: a entrada que a IA recebe, serializada INTEIRA, não contém
// nenhum identificador do paciente sintético, em nenhuma grafia.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montarEntradaIa, pseudonimizarTexto } from '../../src/seguranca/pseudonimizar.js';
import { processarTextoLaudo } from '../../src/pipeline/processarLaudo.js';
import {
  LAUDO_SINTETICO, MENSAGEM_COM_IDENTIFICADORES, PROIBIDOS, encontrarIdentificadores,
} from './pacienteSintetico.js';

const BASE = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs', 'base-conhecimento', 'exames.json'), 'utf8'));
const FICHA_GLICOSE = BASE.exames.find((f) => f.id_canonico === 'glicose');

// O caminho real: texto do laudo → pipeline → (laudo, identificadores) → entrada da IA.
const { laudo, identificadores } = processarTextoLaudo(LAUDO_SINTETICO, { idLaudo: 'teste' });
const GLICOSE = laudo.analitos.find((a) => a.id_canonico === 'glicose');

// "IA falsa" que só captura o que recebeu.
function iaQueCaptura() {
  const recebidas = [];
  return { recebidas, chamar: (entrada) => { recebidas.push(JSON.stringify(entrada)); return { resposta: 'ok' }; } };
}

describe('BWL-07: a entrada da IA não contém identificadores', () => {
  it('explicação: nada do cabeçalho do laudo chega à IA', () => {
    const ia = iaQueCaptura();
    ia.chamar(montarEntradaIa({ analito: GLICOSE, ficha: FICHA_GLICOSE, identificadores }).entrada);
    assert.deepEqual(encontrarIdentificadores(ia.recebidas[0]), []);
  });

  it('chat: a paciente digita o próprio nome, CPF, nascimento, telefone, e-mail e protocolo → nada chega à IA', () => {
    const ia = iaQueCaptura();
    const historico = [
      { papel: 'assistente', texto: 'Explicação da glicose...' },
      { papel: 'paciente', texto: 'Sou a Lúcia Andrade, meu RG é 12.345.678-9' },
    ];
    const { entrada } = montarEntradaIa({
      analito: GLICOSE, ficha: FICHA_GLICOSE, identificadores, mensagem: MENSAGEM_COM_IDENTIFICADORES, historico,
    });
    ia.chamar(entrada);
    assert.deepEqual(encontrarIdentificadores(ia.recebidas[0]), []);
    // A pergunta de verdade continua lá.
    assert.match(entrada.mensagem, /Minha glicose deu 118, é ruim\?/);
  });

  it('o mapa (só na sessão) guarda os valores originais; o texto só tem marcadores', () => {
    const { entrada, mapa } = montarEntradaIa({
      analito: GLICOSE, ficha: FICHA_GLICOSE, identificadores, mensagem: MENSAGEM_COM_IDENTIFICADORES,
    });
    assert.match(entrada.mensagem, /\[PACIENTE_1\]/);
    assert.match(entrada.mensagem, /\[CPF_1\]/);
    assert.match(entrada.mensagem, /\[EMAIL_1\]/);
    assert.equal(mapa['[CPF_1]'], '12345678909');
    assert.equal(mapa['[EMAIL_1]'], 'lucia.andrade@exemplo.com');
  });
});

describe('BWL-07: não regressão (o que a IA precisa continua intacto)', () => {
  const { entrada } = montarEntradaIa({
    analito: GLICOSE, ficha: FICHA_GLICOSE, identificadores, mensagem: MENSAGEM_COM_IDENTIFICADORES,
  });
  it('valor, unidade, faixa, classificação e alerta iguais aos do pipeline', () => {
    assert.equal(entrada.analito.valor, 118);
    assert.equal(entrada.analito.unidade, 'mg/dL');
    assert.deepEqual(entrada.analito.faixa_referencia, { minimo: 70, maximo: 99, minimo_inclusivo: true, maximo_inclusivo: true });
    assert.equal(entrada.analito.classificacao, 'acima');
    assert.equal(entrada.analito.alerta_critico, false);
    assert.equal(entrada.analito.nome_no_laudo, 'Glicose em jejum');
  });
  it('lista de permissão: só os campos previstos entram (nada de texto_original, limite_critico, confianca)', () => {
    assert.deepEqual(Object.keys(entrada).sort(), ['analito', 'ficha', 'mensagem']);
    assert.deepEqual(Object.keys(entrada.analito).sort(), [
      'alerta_critico', 'classificacao', 'faixa_referencia', 'id_canonico', 'nome_no_laudo', 'unidade', 'valor',
    ]);
    assert.deepEqual(Object.keys(entrada.ficha).sort(), ['especialidade', 'id_canonico', 'o_que_avalia', 'significado_resultado']);
  });
  it('significado: só o texto da posição decidida pelo pipeline; dentro da faixa → null; a fonte não vai', () => {
    const montar = (classificacao) => montarEntradaIa({ analito: { ...GLICOSE, classificacao }, ficha: FICHA_GLICOSE }).entrada.ficha;
    assert.equal(montar('acima').significado_resultado, FICHA_GLICOSE.significado_fora_da_faixa.acima);
    assert.equal(montar('abaixo').significado_resultado, FICHA_GLICOSE.significado_fora_da_faixa.abaixo);
    assert.equal(montar('dentro').significado_resultado, null);
    assert.ok(!JSON.stringify(montar('acima')).includes('fonte'));
  });
  it('ficha sem significado_fora_da_faixa → significado_resultado null', () => {
    const { significado_fora_da_faixa: _, ...semTexto } = FICHA_GLICOSE;
    assert.equal(montarEntradaIa({ analito: GLICOSE, ficha: semTexto }).entrada.ficha.significado_resultado, null);
  });
  it('números de exame e faixas não viram marcador', () => {
    const texto = 'Glicose 118 mg/dL (70 a 99), creatinina 0,9 (0,6 a 1,3), colesterol 1.234,5, TSH 4,50 µUI/mL';
    assert.equal(pseudonimizarTexto(texto, identificadores).texto, texto);
  });
});

describe('BWL-07: controle (o detector funciona)', () => {
  it('SEM a varredura, o detector ENCONTRA os identificadores digitados no chat', () => {
    const semVarredura = (texto, _ids, mapa) => ({ texto, mapa });
    const { entrada } = montarEntradaIa(
      { analito: GLICOSE, ficha: FICHA_GLICOSE, identificadores, mensagem: MENSAGEM_COM_IDENTIFICADORES },
      { varrer: semVarredura },
    );
    const achados = encontrarIdentificadores(JSON.stringify(entrada));
    // Tudo que foi digitado precisa ser achado; se o detector não achar, o teste principal não prova nada.
    for (const esperado of ['Lúcia', 'Andrade', '123.456.789-09', '5 de julho de 1988', '(13) 99876-5432', 'lucia.andrade@exemplo.com', 'PED-2026-0042', 'Helena', 'SP 123456']) {
      assert.ok(achados.includes(esperado), `detector não achou "${esperado}"`);
    }
  });
  it('o detector acha variantes: sem acento, caixa alta e só dígitos', () => {
    assert.deepEqual(encontrarIdentificadores('LUCIA', ['Lúcia']), ['Lúcia']);
    assert.deepEqual(encontrarIdentificadores('cpf 12345678909', ['123.456.789-09']), ['123.456.789-09']);
  });
});

describe('pseudonimizarTexto: dicionário (identificadores do laudo)', () => {
  const ids = { paciente: 'Lúcia Fictícia Andrade Teste' };
  it('nome completo vira UM marcador', () => {
    assert.equal(pseudonimizarTexto('Sou Lúcia Fictícia Andrade Teste.', ids).texto, 'Sou [PACIENTE_1].');
  });
  it('sem acento e em caixa alta também', () => {
    assert.equal(pseudonimizarTexto('LUCIA FICTICIA ANDRADE TESTE', ids).texto, '[PACIENTE_1]');
  });
  it('partes do nome, sozinhas', () => {
    assert.equal(pseudonimizarTexto('a andrade e a lucia', ids).texto, 'a [PACIENTE_1] e a [PACIENTE_2]');
  });
  it('preposições do nome não viram marcador ("de", "da")', () => {
    const r = pseudonimizarTexto('dúvida de glicose', { paciente: 'Ana Maria da Costa' });
    assert.equal(r.texto, 'dúvida de glicose');
  });
  it('só palavra inteira: "Ana" não casa dentro de "Banana"', () => {
    assert.equal(pseudonimizarTexto('Banana', { paciente: 'Ana Souza' }).texto, 'Banana');
  });
  it('mesmo valor → mesmo marcador entre mensagens (mapa da sessão)', () => {
    const primeira = pseudonimizarTexto('Andrade', ids);
    const segunda = pseudonimizarTexto('andrade de novo', ids, primeira.mapa);
    assert.equal(segunda.texto, '[PACIENTE_1] de novo');
  });
  it('LIMITE CONHECIDO: sobrenome que é palavra comum ("Teste") também é trocado (falso positivo)', () => {
    assert.equal(pseudonimizarTexto('fiz o teste ontem', ids).texto, 'fiz o [PACIENTE_1] ontem');
  });
  it('sem identificadores (cabeçalho não lido) → só os padrões funcionam', () => {
    assert.equal(pseudonimizarTexto('Lúcia, CPF 123.456.789-09', {}).texto, 'Lúcia, CPF [CPF_1]');
  });
});

describe('pseudonimizarTexto: padrões (o que se digita no chat)', () => {
  const casos = [
    ['CPF com pontuação', 'cpf 123.456.789-09.', 'cpf [CPF_1].'],
    ['CPF sem pontuação', 'cpf 12345678909', 'cpf [CPF_1]'],
    ['RG com rótulo', 'RG: 12.345.678-9', 'RG: [RG_1]'],
    ['RG no formato', 'meu documento 12.345.678-X', 'meu documento [RG_1]'],
    ['data com barra', 'nasci 05/07/1988', 'nasci [DATA_1]'],
    ['data com hífen', 'nasci 05-07-1988', 'nasci [DATA_1]'],
    ['data por extenso', 'nasci em 5 de julho de 1988', 'nasci em [DATA_1]'],
    ['telefone com DDD', 'tel (13) 99876-5432', 'tel [TELEFONE_1]'],
    ['telefone sem DDD', 'tel 99876-5432', 'tel [TELEFONE_1]'],
    ['e-mail', 'escreva para lu.a+x@exemplo.com.br', 'escreva para [EMAIL_1]'],
    ['CEP', 'CEP 11060-001', 'CEP [CEP_1]'],
    ['CRM (a UF entra no marcador)', 'CRM-SP 123456', 'CRM-[CRM_1]'],
    ['protocolo', 'protocolo 2026-778899', 'protocolo [PEDIDO_1]'],
    ['pedido nº', 'pedido nº TESTE-0001', 'pedido nº [PEDIDO_1]'],
    ['prontuário', 'prontuário: PR-5544', 'prontuário: [PEDIDO_1]'],
    ['"meu nome é X"', 'meu nome é Joana da Silva e tenho dúvida', 'meu nome é [PACIENTE_1] e tenho dúvida'],
    ['"me chamo x" minúsculo', 'me chamo joana, ok?', 'me chamo [PACIENTE_1], ok?'],
  ];
  for (const [nome, entrada, esperado] of casos) {
    it(nome, () => assert.equal(pseudonimizarTexto(entrada, {}).texto, esperado));
  }
});

describe('LIMITES CONHECIDOS da varredura (documentados em docs/pseudonimizacao.md)', () => {
  it('nome de terceiro que não está no laudo e sem "meu nome é" passa', () => {
    assert.equal(pseudonimizarTexto('minha mãe Joana também fez', {}).texto, 'minha mãe Joana também fez');
  });
  it('nome digitado com erro passa', () => {
    assert.equal(pseudonimizarTexto('sou a Lúica', { paciente: 'Lúcia Andrade' }).texto, 'sou a Lúica');
  });
});

describe('dados de sanidade do teste', () => {
  it('o paciente sintético passa pelo pipeline e tem todos os identificadores lidos', () => {
    assert.equal(laudo.analitos.length, 2);
    assert.ok(Object.values(identificadores).every((v) => v !== null));
    assert.ok(PROIBIDOS.length > 10);
  });
});
