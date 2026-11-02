// Única porta de saída do front para o back. As telas chamam estas funções e
// não sabem se a resposta veio do back real ou de um mock.
//
// Modo mock: ligado por padrão enquanto o back não existe. Para usar o back
// real, crie frontend/.env.local com VITE_USAR_MOCK=false.
import laudoResultado from './mocks/laudo-resultado.json';
import laudoCritico from './mocks/laudo-resultado-critico.json';
import explicacaoGlicose from './mocks/explicacao-glicose.json';
import explicacaoPadrao from './mocks/explicacao-mensagem-padrao.json';
import chatResposta from './mocks/chat-resposta.json';
import erros from './mocks/erros.json';

const USAR_MOCK = import.meta.env.VITE_USAR_MOCK !== 'false';

// Simula o tempo de resposta do back, para ver os estados de "carregando".
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Toda resposta segue o contrato: { status: "ok", ... } ou
// { status: "erro", erro: { codigo, mensagem_usuario } }. Se a rede cair, o
// fetch nem chega a ter resposta; aí devolvemos um erro no mesmo formato, para
// as telas tratarem tudo de um jeito só.
async function chamar(caminho, opcoes) {
  try {
    const resposta = await fetch(caminho, opcoes);
    return await resposta.json();
  } catch {
    return {
      status: 'erro',
      erro: { codigo: 'SEM_CONEXAO', mensagem_usuario: 'Não conseguimos falar com o servidor. Verifique sua internet e tente de novo.' },
    };
  }
}

// Porta 1 — POST /api/laudos (contrato §5.1).
// No modo mock, o NOME do arquivo escolhe o caso, para testar cada tela:
// "critico" → alerta prioritário; "ilegivel" → erro de leitura; outro → laudo com vários exames.
export async function enviarLaudo(arquivo) {
  if (USAR_MOCK) {
    await esperar(1500);
    const nome = arquivo.name.toLowerCase();
    if (nome.includes('ilegivel')) return erros.ARQUIVO_ILEGIVEL;
    if (nome.includes('critico')) return laudoCritico;
    return laudoResultado;
  }
  const formulario = new FormData();
  formulario.append('arquivo', arquivo);
  return chamar('/api/laudos', { method: 'POST', body: formulario });
}

// Porta 2 — POST /api/explicacoes (contrato §5.2): 1ª mensagem do chat.
// No mock, a creatinina simula a mensagem padrão (segurança reprovou tudo).
export async function pedirExplicacao(idLaudo, idCanonico) {
  if (USAR_MOCK) {
    await esperar(2000);
    if (idCanonico === 'creatinina') return explicacaoPadrao;
    return explicacaoGlicose;
  }
  return chamar('/api/explicacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_laudo: idLaudo, id_canonico: idCanonico }),
  });
}

// Porta 3 — POST /api/chat (contrato §5.3): resposta a uma dúvida digitada.
export async function enviarDuvida(idLaudo, idCanonico, mensagem) {
  if (USAR_MOCK) {
    await esperar(1500);
    return chatResposta;
  }
  return chamar('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_laudo: idLaudo, id_canonico: idCanonico, mensagem }),
  });
}
