// Roda o pipeline (BWL-02 a BWL-06) em um laudo e mostra a saída, para conferir
// à mão. Só imprime o laudo estruturado (sem texto bruto nem dados do paciente).
//   npm run pipeline -- ../samples/laudos/glicose_critico_alto.pdf
//   npm run pipeline -- ../samples/laudos/laudo_protegido.pdf lumie-teste-123
import { readFileSync } from 'node:fs';
import { processarLaudoPdf } from '../src/pipeline/processarLaudo.js';

const [arquivo, senha] = process.argv.slice(2);
if (!arquivo) {
  console.error('Uso: npm run pipeline -- <caminho do PDF> [senha]');
  process.exit(1);
}

try {
  const resultado = await processarLaudoPdf(readFileSync(arquivo), { senha, idLaudo: 'demonstracao' });
  console.log(JSON.stringify(resultado, null, 2));
} catch (erro) {
  // Erros da BWL-02 (vazio, não é PDF, protegido): só o código, nunca o conteúdo.
  console.log(JSON.stringify({ erro_interno: erro.codigo ?? erro.message }, null, 2));
}
