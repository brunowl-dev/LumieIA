// TRANSPORTE ATÉ O MODELO (ISA-01): o único arquivo que fala HTTP com o Ollama Cloud.
// Não sabe nada de exame, prompt ou formato das 5 partes: recebe o texto do
// "system" (instruções) e do "user" (dados), manda ao modelo e devolve o texto
// que ele escreveu. Se a API do Ollama mudar, só este arquivo muda (contrato §4.1).
//
// O que NÃO fica aqui (é do orquestrador, em src/api/adaptadorIa.js):
// nova tentativa, tempo limite e mensagem de reserva. Aqui, qualquer falha
// vira um `throw`; o adaptador transforma em MODELO_INDISPONIVEL (contrato §4.7).
//
// Nada de console.log: system/user carregam dados de saúde (contrato §4.8).

/**
 * @param {{ fetch: Function, baseUrl: string, apiKey: string, modelo: string, temperatura?: number }} config
 * @param {{ system: string, user: string, format?: object }} mensagens
 *   format = JSON Schema que obriga o modelo a responder em JSON com esses campos.
 * @returns {Promise<string>} o texto de message.content (sem o message.thinking)
 */
export async function chamarOllama(config, { system, user, format }) {
  const { fetch, baseUrl, apiKey, modelo, temperatura } = config;

  // Falta de configuração é erro antes de sair para a rede. A mensagem cita só
  // o NOME da variável, nunca o valor (a chave não pode aparecer em erro/log).
  const faltando = [['OLLAMA_BASE_URL', baseUrl], ['OLLAMA_API_KEY', apiKey], ['OLLAMA_MODEL', modelo]]
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);
  if (faltando.length > 0) throw new Error(`Configuração do Ollama incompleta: ${faltando.join(', ')}`);

  const corpo = {
    model: modelo,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: false, // uma resposta inteira, em vez de pedaços (mais simples de validar)
    ...(format ? { format } : {}),
    // Temperatura inválida (variável vazia → NaN) não é enviada: o modelo usa o padrão dele.
    ...(Number.isFinite(temperatura) ? { options: { temperature: temperatura } } : {}),
  };

  let resposta;
  try {
    resposta = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(corpo),
    });
  } catch (erro) {
    throw new Error('Falha de rede ao chamar o Ollama', { cause: erro });
  }

  if (!resposta.ok) {
    // O corpo do erro do Ollama é curto (ex.: "unauthorized"); cortado por segurança.
    const detalhe = (await resposta.text().catch(() => '')).slice(0, 200);
    throw new Error(`Ollama respondeu HTTP ${resposta.status}`, { cause: new Error(detalhe || resposta.statusText) });
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (erro) {
    throw new Error('Resposta do Ollama não é JSON', { cause: erro });
  }

  // Só message.content importa. message.thinking (raciocínio do gpt-oss) é
  // ignorado de propósito: nunca vai para a tela nem para a segurança.
  const conteudo = dados?.message?.content;
  if (typeof conteudo !== 'string') throw new Error('Resposta do Ollama sem message.content');
  return conteudo;
}
