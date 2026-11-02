// Tela 1 — envio do laudo (POST /api/laudos). Três estados:
// escolhendo arquivo → enviando ("Analisando...") → erro (com ação) ou sucesso
// (o resultado sobe para o App, que troca para a tela de exames).
import { useState } from 'react';
import { enviarLaudo } from '../api.js';
import MensagemErro from '../components/MensagemErro.jsx';

const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
const TAMANHO_MAXIMO_MB = 10; // igual a UPLOAD_MAX_MB do .env.example

export default function TelaEnvio({ onResultado }) {
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  // Conferência rápida antes de enviar, só para poupar a espera do paciente.
  // O back confere de novo (FORMATO_NAO_SUPORTADO / ARQUIVO_MUITO_GRANDE).
  function escolherArquivo(evento) {
    const escolhido = evento.target.files[0];
    setErro(null);
    setArquivo(null);
    if (!escolhido) return;
    if (!TIPOS_ACEITOS.includes(escolhido.type)) {
      setErro({ mensagem_usuario: 'Envie apenas PDF, JPG ou PNG.' });
      return;
    }
    if (escolhido.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      setErro({ mensagem_usuario: `O arquivo deve ter no máximo ${TAMANHO_MAXIMO_MB} MB.` });
      return;
    }
    setArquivo(escolhido);
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const resposta = await enviarLaudo(arquivo);
    setEnviando(false);
    if (resposta.status === 'ok') {
      onResultado(resposta);
    } else {
      setErro(resposta.erro);
      setArquivo(null);
    }
  }

  if (enviando) {
    return (
      <div className="carregando" role="status">
        <div className="girando" aria-hidden="true" />
        <div>
          <strong>Analisando seu exame...</strong>
          <p className="subtitulo">Estamos lendo os valores do laudo. Isso leva alguns segundos.</p>
        </div>
      </div>
    );
  }

  return (
    <section>
      <span className="eyebrow">SEUS EXAMES, SEMPRE COM VOCÊ</span>
      <h1 className="titulo">Entenda seu exame</h1>
      <p className="subtitulo">
        Envie o laudo do laboratório. Mostramos cada resultado com a faixa de referência e, se quiser,
        uma explicação em linguagem simples.
      </p>

      {/* O <label> envolve o input: clicar em qualquer parte da área abre a escolha de arquivo. */}
      <label className="area-envio">
        <span className="area-envio-icone" aria-hidden="true">⇪</span>
        {arquivo ? (
          <span className="arquivo-escolhido">{arquivo.name}</span>
        ) : (
          <strong>Escolha o arquivo do exame</strong>
        )}
        <span className="area-envio-dica">PDF, JPG ou PNG, até {TAMANHO_MAXIMO_MB} MB.</span>
        <input type="file" accept={TIPOS_ACEITOS.join(',')} onChange={escolherArquivo} />
      </label>

      {erro && <MensagemErro erro={erro} />}

      <div className="acoes">
        <button type="button" className="botao" disabled={!arquivo} onClick={enviar}>
          Enviar exame →
        </button>
      </div>

      <p className="nota-privacidade">
        Seu laudo é lido no nosso servidor. A inteligência artificial recebe só os valores dos exames,
        nunca seu nome ou documentos. Use apenas laudos fictícios nesta demonstração.
      </p>
    </section>
  );
}
