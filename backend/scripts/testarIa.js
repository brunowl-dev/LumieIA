// Teste MANUAL da IA com o modelo real (ISA-01 a ISA-06). Fora do `npm test`:
// precisa de internet e da chave no .env da raiz.
//
// Uso (na pasta backend):  npm.cmd run testar:ia            (1 rodada)
//                          npm.cmd run testar:ia -- 5       (5 rodadas)
//
// Para cada entrada de samples/entradas-ia/, faz o MESMO laço do servidor
// (gerarComSeguranca): gera, verifica, e se reprovar pede de novo com os
// motivos, até MAX_REGENERACOES. Imprime a resposta e os motivos. As entradas
// são sintéticas, então imprimir aqui pode; no código de src/ia, nunca.
//
// O resumo no fim (aprovadas de 1ª, depois de regenerar, mensagem padrão, erro)
// é o número que vai para docs/ia-resultados.md e para a apresentação.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarClienteIa } from '../src/ia/index.js';
import { gerarComSeguranca } from '../src/api/gerarComSeguranca.js';
import { MAX_REGENERACOES } from '../src/api/config.js';
import { verificarChat, verificarExplicacao } from '../src/seguranca/verificarResposta.js';
import { montarChatPadrao, montarExplicacaoPadrao } from '../src/seguranca/mensagemPadrao.js';

const PASTA = join(import.meta.dirname, '..', '..', 'samples', 'entradas-ia');
const rodadas = Number(process.argv[2] ?? 1);
const cliente = criarClienteIa();
const resumo = { primeira: 0, regenerada: 0, padrao: 0, erro: 0 };
const tempos = [];

for (let rodada = 1; rodada <= rodadas; rodada += 1) {
  for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith('.json')).sort()) {
    const entrada = JSON.parse(readFileSync(join(PASTA, arquivo), 'utf8'));
    const ehChat = entrada.mensagem !== undefined;
    const { analito, ficha } = entrada;
    console.log(`\n=== rodada ${rodada} · ${arquivo} (${ehChat ? 'chat' : 'explicação'}) ===`);
    const inicio = Date.now();
    try {
      const r = await gerarComSeguranca({
        gerar: (motivos) => (ehChat
          ? cliente.responderChat(entrada, { motivosReprovacao: motivos })
          : cliente.gerarExplicacao(entrada, { motivosReprovacao: motivos })),
        verificar: (resposta) => (ehChat ? verificarChat(resposta, ficha) : verificarExplicacao(resposta, analito, ficha)),
        mensagemPadrao: () => (ehChat ? montarChatPadrao(ficha) : montarExplicacaoPadrao(analito, ficha)),
        maxRegeneracoes: MAX_REGENERACOES,
        aoReprovar: (tentativa, motivos) => console.log(`  tentativa ${tentativa + 1} REPROVADA: ${motivos.join(', ')}`),
      });
      const segundos = (Date.now() - inicio) / 1000;
      tempos.push(segundos);
      if (r.origem_texto === 'mensagem_padrao') resumo.padrao += 1;
      else if (r.tentativas_regeneracao === 0) resumo.primeira += 1;
      else resumo.regenerada += 1;
      console.log(`  resultado: ${r.origem_texto}, regenerações: ${r.tentativas_regeneracao}, ${segundos.toFixed(1)} s`);
      console.log(JSON.stringify(r.conteudo, null, 2));
    } catch (erro) {
      resumo.erro += 1;
      console.log(`  ERRO: ${erro.message}${erro.cause ? ` (causa: ${erro.cause.message ?? erro.cause})` : ''}`);
    }
  }
}

const total = Object.values(resumo).reduce((a, b) => a + b, 0);
const media = tempos.length ? (tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(1) : '-';
const maximo = tempos.length ? Math.max(...tempos).toFixed(1) : '-';
console.log(`\nRESUMO (${total} chamadas, MAX_REGENERACOES=${MAX_REGENERACOES}):`);
console.log(`  aprovada de 1ª: ${resumo.primeira} · aprovada depois de regenerar: ${resumo.regenerada} · mensagem padrão: ${resumo.padrao} · erro: ${resumo.erro}`);
console.log(`  tempo por resposta: média ${media} s, máximo ${maximo} s`);
