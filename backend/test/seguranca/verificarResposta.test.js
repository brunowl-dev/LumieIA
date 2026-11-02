// Camada de segurança (BWL-08). Rodar: npm test.
// Os casos principais vêm de samples/respostas-ia/manifesto.json: cada resposta
// tem o resultado esperado e os motivos exatos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MOTIVOS, normalizar, procurarTermos, verificarChat, verificarExplicacao,
} from '../../src/seguranca/verificarResposta.js';
import { AVISO_PADRAO, montarChatPadrao, montarExplicacaoPadrao } from '../../src/seguranca/mensagemPadrao.js';

const SAMPLES = join(import.meta.dirname, '..', '..', '..', 'samples');
const lerJson = (...partes) => JSON.parse(readFileSync(join(SAMPLES, ...partes), 'utf8'));
const BASE = JSON.parse(readFileSync(join(SAMPLES, '..', 'docs', 'base-conhecimento', 'exames.json'), 'utf8'));
const ficha = (id) => BASE.exames.find((f) => f.id_canonico === id);
const manifesto = lerJson('respostas-ia', 'manifesto.json');

function verificarCaso(caso) {
  const resposta = lerJson('respostas-ia', caso.arquivo);
  const [analito] = lerJson(caso.analito).analitos;
  const f = ficha(analito.id_canonico);
  return caso.tipo === 'chat' ? verificarChat(resposta, f) : verificarExplicacao(resposta, analito, f);
}

describe('samples/respostas-ia/manifesto.json', () => {
  for (const caso of manifesto.casos) {
    it(`${caso.arquivo} → ${caso.esperado} ${caso.motivos.join(', ')}`, () => {
      const r = verificarCaso(caso);
      assert.equal(r.aprovada ? 'aprovada' : 'reprovada', caso.esperado);
      assert.deepEqual(r.motivos, caso.motivos);
    });
  }
  it('o manifesto cobre todos os códigos de motivo', () => {
    const cobertos = new Set(manifesto.casos.flatMap((c) => c.motivos));
    assert.deepEqual(Object.values(MOTIVOS).filter((m) => !cobertos.has(m)), []);
  });
});

describe('normalização', () => {
  it('acento, caixa, espaços e pontuação', () => {
    assert.equal(normalizar('  Você TEM   diabetes!!  '), 'voce tem diabetes');
  });
});

describe('termos proibidos: negação', () => {
  it('"não é um diagnóstico" passa', () => assert.deepEqual(procurarTermos('Isto não é um diagnóstico.'), {}));
  it('"este resultado não permite fazer um diagnóstico" passa', () => {
    assert.deepEqual(procurarTermos('Este resultado, sozinho, não permite fazer um diagnóstico.'), {});
  });
  it('"o diagnóstico é" reprova', () => assert.deepEqual(Object.keys(procurarTermos('O diagnóstico é claro.')), ['diagnostico']));
  it('"não há motivo para preocupação" reprova (negar o veredito é veredito)', () => {
    assert.deepEqual(Object.keys(procurarTermos('Não há motivo para preocupação.')), ['veredito']);
  });
  it('negação só apaga a expressão dela: o resto da frase continua verificado', () => {
    assert.deepEqual(Object.keys(procurarTermos('Isto não é um diagnóstico, mas você tem diabetes.')), ['diagnostico']);
  });
  it('palavra inteira: "dose" não casa dentro de "glicose"; "grave" não casa em "gravei"', () => {
    assert.deepEqual(procurarTermos('glicose, gravei o resultado'), {});
  });
  it('"merece atenção" é a linguagem permitida', () => assert.deepEqual(procurarTermos('O valor merece atenção.'), {}));
});

describe('o aviso é apagado antes da busca, mas só ele', () => {
  it('aviso com "diagnóstico" passa', () => {
    assert.deepEqual(procurarTermos('Esta explicação não substitui o diagnóstico de um médico.'), {});
  });
  it('termo proibido NA MESMA FRASE do aviso ainda reprova', () => {
    assert.deepEqual(Object.keys(procurarTermos('Você tem diabetes e esta explicação não substitui a avaliação de um profissional de saúde.')), ['diagnostico']);
  });
});

describe('verificações 6 e 7 (valor e posição)', () => {
  const [glicose] = lerJson('glicose-alterada.json').analitos;
  const base = montarExplicacaoPadrao(glicose, ficha('glicose'));
  const com = (valorEPosicao) => verificarExplicacao({ ...base, valor_e_posicao: valorEPosicao }, glicose, ficha('glicose')).motivos;
  it('número inventado (além de valor e faixa) reprova', () => {
    assert.deepEqual(com('Seu resultado foi 118 mg/dL, 19 acima do limite de 99, então está acima da faixa.'), ['valor_divergente']);
  });
  it('valor ausente reprova', () => assert.deepEqual(com('O valor está acima da faixa de 70 a 99.'), ['valor_divergente']));
  it('"elevado" conta como acima', () => assert.deepEqual(com('Seu resultado, 118 mg/dL, está elevado em relação à faixa de 70 a 99.'), []));
  it('posição ausente reprova', () => assert.deepEqual(com('Seu resultado foi 118 mg/dL; a faixa é de 70 a 99.'), ['classificacao_contradita']));
  it('duas posições reprovam (ambíguo)', () => {
    assert.deepEqual(com('Seu resultado foi 118 mg/dL, acima da faixa, mas abaixo de muitos casos.'), ['classificacao_contradita']);
  });
  it('vírgula decimal: 0,9 = 0.9', () => {
    const creatinina = { valor: 0.9, unidade: 'mg/dL', classificacao: 'dentro', faixa_referencia: { minimo: 0.6, maximo: 1.3 } };
    const r = verificarExplicacao(montarExplicacaoPadrao(creatinina, ficha('creatinina')), creatinina, ficha('creatinina'));
    assert.deepEqual(r.motivos, []);
  });
});

describe('resposta malformada', () => {
  it('explicação null → reprovada sem quebrar', () => {
    const [glicose] = lerJson('glicose-alterada.json').analitos;
    assert.equal(verificarExplicacao(null, glicose, ficha('glicose')).aprovada, false);
  });
  it('chat sem o campo resposta → parte_ausente', () => {
    assert.ok(verificarChat({ texto: 'x' }, ficha('glicose')).motivos.includes('parte_ausente'));
  });
  it('chat: aviso no meio, não no fim → aviso_ausente', () => {
    const r = verificarChat({ resposta: `${AVISO_PADRAO} O jejum é necessário. Ele dura algumas horas. E evita erro no valor.` }, ficha('glicose'));
    assert.deepEqual(r.motivos, ['aviso_ausente']);
  });
});

describe('mensagem padrão passa na própria camada', () => {
  const ANALITOS = [
    ...lerJson('varios-exames.json').analitos.filter((a) => a.id_canonico),
    ...['glicose-normal.json', 'glicose-alterada.json', 'glicose-critica.json'].map((a) => lerJson(a).analitos[0]),
    { id_canonico: 'colesterol_total', valor: 238, unidade: 'mg/dL', classificacao: 'acima', alerta_critico: false,
      faixa_referencia: { minimo: null, maximo: 190, minimo_inclusivo: null, maximo_inclusivo: false } },
  ];
  for (const analito of ANALITOS) {
    it(`explicação padrão: ${analito.id_canonico} ${analito.valor} (${analito.classificacao}${analito.alerta_critico ? ', crítico' : ''})`, () => {
      const f = ficha(analito.id_canonico);
      assert.deepEqual(verificarExplicacao(montarExplicacaoPadrao(analito, f), analito, f), { aprovada: true, motivos: [] });
    });
  }
  for (const f of BASE.exames) {
    it(`chat padrão: ${f.id_canonico}`, () => {
      assert.deepEqual(verificarChat(montarChatPadrao(f), f), { aprovada: true, motivos: [] });
    });
  }
});

describe('custo dos falsos positivos (medido nos samples; vai para docs/seguranca-verificacoes.md)', () => {
  it('nenhuma resposta marcada como boa no manifesto é reprovada', () => {
    const boas = manifesto.casos.filter((c) => c.esperado === 'aprovada');
    const reprovadasIndevidamente = boas.filter((c) => !verificarCaso(c).aprovada).map((c) => c.arquivo);
    assert.deepEqual(reprovadasIndevidamente, []);
  });
  it('FALSOS POSITIVOS CONHECIDOS (frases aceitáveis que a camada reprova)', () => {
    const conhecidos = [
      ['Isso não significa que você tem diabetes.', 'diagnostico'],
      ['Não se preocupe com o jejum: água pode.', 'veredito'],
      ['O exame ajuda a ver se a dose de açúcar no sangue está na faixa.', 'prescricao'],
    ];
    for (const [frase, categoria] of conhecidos) assert.ok(categoria in procurarTermos(frase), frase);
  });
});
