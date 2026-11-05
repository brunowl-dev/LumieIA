// Tela inicial: catálogo de laudos de demonstração (sintéticos). Três passos:
// escolher um laudo → confirmar o consentimento → "Analisando..." → tela de exames.
//
// O arquivo escolhido vai para POST /api/laudos pelo mesmo enviarLaudo() da tela
// de envio: o back lê o laudo de verdade a cada escolha (ver laudosDemo.js).
// Quem quiser enviar o próprio arquivo usa o link no fim da tela (TelaEnvio).
import { useEffect, useRef, useState } from 'react';
import { enviarLaudo } from '../api.js';
import Icone from '../components/Icone.jsx';
import MensagemErro from '../components/MensagemErro.jsx';
import { LAUDOS_DEMO, carregarLaudoDemo } from '../laudosDemo.js';

export default function TelaCatalogo({ onResultado, onEnviarArquivo }) {
  const [escolhido, setEscolhido] = useState(null);
  // O artigo exige consentimento específico para tratar o exame: sem ele, não lê.
  const [consentimento, setConsentimento] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState(null);
  const painel = useRef(null);

  // Ao escolher um laudo, o painel de confirmação aparece embaixo da lista:
  // rola até ele para o paciente ver o próximo passo.
  useEffect(() => {
    if (escolhido) painel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [escolhido]);

  function escolher(laudo) {
    if (lendo) return;
    setEscolhido(laudo);
    setErro(null);
  }

  async function ler() {
    setLendo(true);
    setErro(null);
    let resposta;
    try {
      const arquivo = await carregarLaudoDemo(escolhido);
      resposta = await enviarLaudo(arquivo);
    } catch {
      resposta = { status: 'erro', erro: { mensagem_usuario: 'Não conseguimos abrir este laudo de demonstração. Tente outro.' } };
    }
    setLendo(false);
    if (resposta.status === 'ok') onResultado(resposta);
    else setErro(resposta.erro);
  }

  return (
    <>
      <div className="exams-heading">
        <div>
          <p className="eyebrow">LAUDOS DE DEMONSTRAÇÃO</p>
          <h1>Escolha um exame</h1>
          <span>Todos os laudos abaixo são fictícios. Escolha um para ver como a Lumie lê e explica o resultado.</span>
        </div>
      </div>

      <div className="catalogo">
        {LAUDOS_DEMO.map((laudo, indice) => {
          const selecionado = escolhido?.arquivo === laudo.arquivo;
          return (
            <button
              key={laudo.arquivo}
              type="button"
              className={`laudo-card${selecionado ? ' selecionado' : ''}`}
              // Atraso por índice: os cartões entram um depois do outro (ver styles.css).
              style={{ '--ordem': indice }}
              aria-pressed={selecionado}
              disabled={lendo && !selecionado}
              onClick={() => escolher(laudo)}
            >
              <i className={`laudo-icone tipo-${laudo.tipo}`}>
                <Icone nome={laudo.tipo === 'foto' ? 'camera' : 'documento'} />
              </i>
              <span className="laudo-texto">
                <strong>{laudo.titulo}</strong>
                <small>{laudo.exames}</small>
              </span>
              <span className="laudo-caso">{laudo.caso}</span>
              <span className="laudo-formato">{laudo.tipo === 'foto' ? 'Foto (JPG)' : 'PDF'}</span>
            </button>
          );
        })}
      </div>

      {escolhido && (
        // key: trocar de laudo refaz a animação de entrada do painel.
        <section key={escolhido.arquivo} ref={painel} className="painel-envio confirmar-leitura" aria-live="polite">
          <p className="eyebrow">LAUDO ESCOLHIDO</p>
          <h2>
            {escolhido.titulo} <small>· {escolhido.caso}</small>
          </h2>

          {lendo ? (
            <div className="carregando" role="status">
              <div className="girando" aria-hidden="true" />
              <div>
                <strong>Analisando seu exame...</strong>
                <p>
                  {escolhido.tipo === 'foto'
                    ? 'Estamos lendo a foto do laudo. Isso pode levar alguns segundos.'
                    : 'Estamos lendo os valores do laudo. Isso leva alguns segundos.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {erro && <MensagemErro erro={erro} />}

              <label className="consentimento">
                <input
                  type="checkbox"
                  checked={consentimento}
                  onChange={(evento) => setConsentimento(evento.target.checked)}
                />
                <span>
                  Autorizo a Lumie a ler este exame para mostrar os resultados e, quando eu pedir, gerar explicações com
                  inteligência artificial. Meu nome e meus documentos não são enviados à inteligência artificial.
                </span>
              </label>

              <button type="button" className="primary" disabled={!consentimento} onClick={ler}>
                Ler este exame →
              </button>
            </>
          )}
        </section>
      )}

      <p className="link-envio">
        Tem outro laudo?{' '}
        <button type="button" onClick={onEnviarArquivo} disabled={lendo}>
          Enviar um arquivo
        </button>
      </p>
    </>
  );
}
