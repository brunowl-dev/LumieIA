// Gera samples/laudos/texto_extraido/<laudo>.txt para cada PDF digital do
// gabarito, usando o próprio extrator (BWL-02). A BWL-03 é testada sobre esses
// textos, sem abrir PDFs. Rode de novo sempre que um laudo ou o extrator mudar:
//   npm run gerar:texto-extraido
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { extrairTextoPdf } from '../src/pipeline/extrairTextoPdf.js';

const PASTA_LAUDOS = join(import.meta.dirname, '..', '..', 'samples', 'laudos');
const PASTA_SAIDA = join(PASTA_LAUDOS, 'texto_extraido');

const gabarito = JSON.parse(readFileSync(join(PASTA_LAUDOS, 'gabarito.json'), 'utf8'));
mkdirSync(PASTA_SAIDA, { recursive: true });

for (const laudo of gabarito.laudos.filter((l) => l.tipo === 'pdf_digital')) {
  const { texto } = await extrairTextoPdf(readFileSync(join(PASTA_LAUDOS, laudo.arquivo)));
  const saida = join(PASTA_SAIDA, laudo.arquivo.replace(/\.pdf$/, '.txt'));
  writeFileSync(saida, texto, 'utf8');
  console.log(`ok ${laudo.arquivo}`); // só o nome do arquivo (sintético), nunca o texto
}
