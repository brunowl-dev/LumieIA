// Tela 3 — chat de UM exame (contrato §1, momentos 2 e 3).
// Ao abrir, pede a explicação (POST /api/explicacoes): ela é a 1ª mensagem do chat,
// nas 5 partes e na ordem do artigo. Depois o paciente digita dúvidas (POST /api/chat).
// Tudo que aparece aqui já passou pela camada de segurança no back.
//
// Se o exame já tem conversa (`conversaInicial`, guardada no App: veio da tela
// "Todas as explicações" ou de uma visita anterior a este chat), ela é retomada
// e a explicação NÃO é pedida de novo: o texto na tela continua igual ao que o
// back guardou no histórico do chat.
import { useEffect, useRef, useState } from 'react';
import { enviarDuvida, pedirExplicacao } from '../api.js';
import AvisoMedico from '../components/AvisoMedico.jsx';
import { Explicacao, NotaMensagemPadrao } from '../components/Explicacao.jsx';
import Icone from '../components/Icone.jsx';
import MensagemErro from '../components/MensagemErro.jsx';
import SeloStatus, { formatarNumero } from '../components/SeloStatus.jsx';

export default function TelaChat({ idLaudo, exame, conversaInicial, onConversa, onVoltar, onNovoEnvio }) {
  const jaTemConversa = Boolean(conversaInicial?.length);
  // Cada mensagem: { autor: 'lumie' | 'paciente', texto?, explicacao?, origem? }
  const [mensagens, setMensagens] = useState(() => conversaInicial ?? []);
  const [carregandoExplicacao, setCarregandoExplicacao] = useState(!jaTemConversa);
  const [erroExplicacao, setErroExplicacao] = useState(null);
  const [tentativa, setTentativa] = useState(0); // muda → pede a explicação de novo
  const [duvida, setDuvida] = useState('');
  const [respondendo, setRespondendo] = useState(false);
  const [erroDuvida, setErroDuvida] = useState(null);
  const fimDaConversa = useRef(null);

  // Momento 2: pede a explicação ao abrir a tela (e de novo em "Tentar de novo").
  useEffect(() => {
    // Conversa retomada: a explicação já está na tela (só a 1ª abertura pula).
    if (jaTemConversa && tentativa === 0) return undefined;
    // "ignorar" evita usar uma resposta antiga se o paciente sair da tela antes
    // de ela chegar (e a chamada dupla do StrictMode no modo de desenvolvimento).
    let ignorar = false;
    setCarregandoExplicacao(true);
    setErroExplicacao(null);
    pedirExplicacao(idLaudo, exame.id_canonico).then((resposta) => {
      if (ignorar) return;
      setCarregandoExplicacao(false);
      if (resposta.status === 'ok') {
        setMensagens([{ autor: 'lumie', explicacao: resposta.explicacao, origem: resposta.origem_texto }]);
      } else {
        setErroExplicacao(resposta.erro);
      }
    });
    return () => {
      ignorar = true;
    };
  }, [idLaudo, exame.id_canonico, tentativa]);

  // Guarda a conversa no App, para ela continuar se o paciente sair e voltar.
  useEffect(() => {
    if (mensagens.length > 0) onConversa(mensagens);
  }, [mensagens]);

  // Rola até a última mensagem sempre que a conversa cresce.
  useEffect(() => {
    fimDaConversa.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensagens, respondendo]);

  // Momento 3: dúvida digitada pelo paciente.
  async function enviar(evento) {
    evento.preventDefault();
    const texto = duvida.trim();
    if (!texto) return;
    setMensagens((atuais) => [...atuais, { autor: 'paciente', texto }]);
    setDuvida('');
    setErroDuvida(null);
    setRespondendo(true);
    const resposta = await enviarDuvida(idLaudo, exame.id_canonico, texto);
    setRespondendo(false);
    if (resposta.status === 'ok') {
      setMensagens((atuais) => [...atuais, { autor: 'lumie', texto: resposta.resposta, origem: resposta.origem_texto }]);
    } else {
      setErroDuvida(resposta.erro);
    }
  }

  // Cada erro do contrato (§7) leva a uma ação diferente.
  function acaoDoErro(erro) {
    if (erro.codigo === 'SESSAO_EXPIRADA') return { textoAcao: 'Enviar o laudo de novo', onAcao: onNovoEnvio };
    if (erro.codigo === 'EXAME_NAO_ENCONTRADO') return { textoAcao: 'Voltar aos resultados', onAcao: onVoltar };
    return { textoAcao: 'Tentar de novo', onAcao: () => setTentativa((n) => n + 1) };
  }

  const podeDigitar = mensagens.length > 0 && !respondendo;

  return (
    <>
      <div className="exams-heading">
        <div>
          <p className="eyebrow">EXPLICAR COM IA</p>
          <h1>{exame.nome}</h1>
          <span>Pergunte o que quiser sobre este exame. Cada conversa é sobre um exame só.</span>
        </div>
        <button type="button" className="secondary" onClick={onVoltar}>
          ← Voltar aos resultados
        </button>
      </div>

      {/* Resumo do exame: os mesmos dados da tela de exames, para o paciente não perder o contexto. */}
      <div className={`exam-row cor-${exame.cor}`}>
        <i className="lab">
          <Icone nome="frasco" />
        </i>
        <div className="exam-row-texto">
          <p className="exam-valor">
            {formatarNumero(exame.valor)} <small>{exame.unidade}</small>
          </p>
          <small>Referência do laudo: {exame.faixa_referencia.texto_original}</small>
        </div>
        <SeloStatus item={exame} />
      </div>

      <section className="chat" aria-label={`Conversa sobre ${exame.nome}`}>
        <div className="chat-mensagens" aria-live="polite">
          {carregandoExplicacao && (
            <div className="carregando" role="status">
              <div className="girando" aria-hidden="true" />
              <div>
                <strong>Preparando a explicação...</strong>
                <p>A resposta passa por uma verificação de segurança antes de aparecer.</p>
              </div>
            </div>
          )}

          {erroExplicacao && <MensagemErro erro={erroExplicacao} {...acaoDoErro(erroExplicacao)} />}

          {mensagens.map((mensagem, indice) =>
            mensagem.autor === 'paciente' ? (
              <p key={indice} className="balao balao-paciente">
                {mensagem.texto}
              </p>
            ) : (
              <div key={indice} className="balao balao-lumie">
                <span className="balao-autor">
                  <Icone nome="faisca" /> Lumie
                </span>
                {mensagem.explicacao ? <Explicacao explicacao={mensagem.explicacao} /> : <p>{mensagem.texto}</p>}
                <NotaMensagemPadrao origem={mensagem.origem} />
              </div>
            ),
          )}

          {respondendo && (
            <p className="balao balao-lumie digitando" role="status">
              Lumie está escrevendo...
            </p>
          )}

          {erroDuvida && <MensagemErro erro={erroDuvida} {...acaoDoErro(erroDuvida)} />}
          <div ref={fimDaConversa} />
        </div>

        <form className="chat-campo" onSubmit={enviar}>
          <label htmlFor="duvida" className="visualmente-oculto">
            Sua dúvida sobre {exame.nome}
          </label>
          <input
            id="duvida"
            value={duvida}
            onChange={(evento) => setDuvida(evento.target.value)}
            placeholder={podeDigitar ? 'Digite sua dúvida sobre este exame...' : 'Aguarde a explicação...'}
            disabled={!podeDigitar}
            maxLength={500}
            autoComplete="off"
          />
          <button type="submit" className="primary" disabled={!podeDigitar || !duvida.trim()}>
            Enviar
          </button>
        </form>
      </section>

      <AvisoMedico />
    </>
  );
}
