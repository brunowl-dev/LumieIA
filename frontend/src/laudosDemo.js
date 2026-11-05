// Laudos de demonstração do catálogo (tela inicial). Todos SINTÉTICOS: são cópias
// de samples/laudos/, guardadas em frontend/public/laudos/ para o navegador baixar.
//
// Escolher um laudo aqui NÃO pula o pipeline: o front baixa o arquivo e o envia
// para POST /api/laudos exatamente como o envio manual. Texto, OCR, classificação
// e alerta continuam sendo feitos pelo back, de verdade, a cada escolha.
//
// "caso" descreve o cenário de teste para quem apresenta. Não é o resultado: o
// resultado (cor, alerta) só aparece depois que o back lê o arquivo.
export const LAUDOS_DEMO = [
  {
    arquivo: 'painel_misto_layoutA.pdf',
    titulo: 'Painel de exames',
    exames: 'Glicose, hemoglobina, TSH e colesterol',
    caso: 'Vários exames no mesmo laudo',
    tipo: 'pdf',
  },
  {
    arquivo: 'glicose_normal.pdf',
    titulo: 'Glicose em jejum',
    exames: 'Glicose',
    caso: 'Resultado dentro da faixa',
    tipo: 'pdf',
  },
  {
    arquivo: 'creatinina_acima.pdf',
    titulo: 'Creatinina',
    exames: 'Creatinina',
    caso: 'Resultado fora da faixa',
    tipo: 'pdf',
  },
  {
    arquivo: 'glicose_critico_alto.pdf',
    titulo: 'Glicose em jejum',
    exames: 'Glicose',
    caso: 'Valor muito distante da faixa (alerta)',
    tipo: 'pdf',
  },
  {
    arquivo: 'foto_glicose_acima.jpg',
    titulo: 'Foto do laudo',
    exames: 'Glicose',
    caso: 'Leitura por OCR de uma foto',
    tipo: 'foto',
  },
  {
    arquivo: 'painel_parcial_ilegivel.pdf',
    titulo: 'Painel com falhas',
    exames: 'Glicose, hemoglobina, TSH e colesterol',
    caso: 'Parte do laudo ilegível',
    tipo: 'pdf',
  },
  {
    arquivo: 'foto_borrada.jpg',
    titulo: 'Foto borrada',
    exames: 'Glicose',
    caso: 'Imagem que não dá para ler',
    tipo: 'foto',
  },
];

// Baixa o laudo da pasta pública do front e o transforma num File, o mesmo tipo
// de objeto que o <input type="file"> entrega. Assim enviarLaudo() não muda.
export async function carregarLaudoDemo(laudo) {
  const resposta = await fetch(`/laudos/${laudo.arquivo}`);
  if (!resposta.ok) throw new Error(`Laudo de demonstração não encontrado: ${laudo.arquivo}`);
  const conteudo = await resposta.blob();
  const tipo = laudo.tipo === 'foto' ? 'image/jpeg' : 'application/pdf';
  return new File([conteudo], laudo.arquivo, { type: tipo });
}
