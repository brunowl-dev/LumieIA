// Tela 1 — envio do laudo (POST /api/laudos). Três estados:
// escolhendo arquivo → enviando ("Analisando...") → erro (com ação) ou sucesso
// (o resultado sobe para o App, que troca para a tela de exames).
// Visual do formulário "Adicionar exame" do app Lumie.
import { useState } from 'react';
import { enviarLaudo } from '../api.js';
import Icone from '../components/Icone.jsx';
import MensagemErro from '../components/MensagemErro.jsx';

const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
const TAMANHO_MAXIMO_MB = 10; // igual a UPLOAD_MAX_MB do .env.example

export default function TelaEnvio({ onResultado }) {
  const [arquivo, setArquivo] = useState(null);
  // O artigo exige consentimento específico para tratar o exame: sem ele, não envia.
  const [consentimento, setConsentimento] = useState(false);
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

  async function enviar(evento) {
    evento.preventDefault();
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

  return (
    <>
      <div className="exams-heading">
        <div>
          <p className="eyebrow">SEUS EXAMES, SEMPRE COM VOCÊ</p>
          <h1>Entenda seu exame</h1>
          <span>Organize, acompanhe e entenda seus resultados em um só lugar.</span>
        </div>
      </div>

      <form className="painel-envio" onSubmit={enviar}>
        <p className="eyebrow">ADICIONAR EXAME</p>
        <h2>Envie o laudo do laboratório</h2>
        <p className="subcopy">
          Mostramos cada resultado com a faixa de referência do seu laudo e, se quiser, uma explicação em
          linguagem simples.
        </p>

        {enviando ? (
          <div className="carregando" role="status">
            <div className="girando" aria-hidden="true" />
            <div>
              <strong>Analisando seu exame...</strong>
              <p>Estamos lendo os valores do laudo. Isso leva alguns segundos.</p>
            </div>
          </div>
        ) : (
          <>
            {/* O <label> envolve o input: clicar em qualquer parte da área abre a escolha de arquivo. */}
            <label className="area-envio">
              <i>
                <Icone nome="documento" />
              </i>
              <span>
                <strong>{arquivo ? arquivo.name : 'Documento do exame'}</strong>
                <small className="upload-hint">PDF, JPG ou PNG, até {TAMANHO_MAXIMO_MB} MB.</small>
              </span>
              <span className="area-envio-acao">{arquivo ? 'Trocar' : 'Escolher arquivo'}</span>
              <input type="file" accept={TIPOS_ACEITOS.join(',')} onChange={escolherArquivo} />
            </label>

            {erro && <MensagemErro erro={erro} />}

            <label className="consentimento">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(evento) => setConsentimento(evento.target.checked)}
              />
              <span>
                Autorizo a Lumie a ler este exame para mostrar os resultados e, quando eu pedir, gerar explicações
                com inteligência artificial. Meu nome e meus documentos não são enviados à inteligência artificial.
              </span>
            </label>

            <button type="submit" className="primary" disabled={!arquivo || !consentimento}>
              Enviar exame →
            </button>
          </>
        )}

        <p className="ocr-disclaimer">
          Seu laudo é lido no nosso servidor. Use apenas laudos fictícios nesta demonstração.
        </p>
      </form>
    </>
  );
}
