// Ponto de entrada do front. O App guarda em qual tela o paciente está:
// sem resultado → catálogo de laudos de demonstração (ou envio manual, pelo link);
// com resultado → exames; "Explicar todos" → todas as explicações; com exame
// escolhido → chat do exame.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BoasVindas from './components/BoasVindas.jsx';
import ChatFlutuante from './components/ChatFlutuante.jsx';
import Layout from './components/Layout.jsx';
import TelaCatalogo from './telas/TelaCatalogo.jsx';
import TelaChat from './telas/TelaChat.jsx';
import TelaEnvio from './telas/TelaEnvio.jsx';
import TelaExames from './telas/TelaExames.jsx';
import TelaExplicacoes from './telas/TelaExplicacoes.jsx';
import './styles.css';

function App() {
  // resultado = resposta de POST /api/laudos (contrato §5.1), ou null.
  const [resultado, setResultado] = useState(null);
  // exameAberto = item cujo chat está aberto, ou null.
  const [exameAberto, setExameAberto] = useState(null);
  // true = tela "Todas as explicações" (o chat aberto a partir dela volta para ela).
  const [vendoTodas, setVendoTodas] = useState(false);
  // Conversa de cada exame já explicado, por id_canonico: [{ autor, explicacao?, texto?, origem? }].
  // Fica aqui, e não em cada tela, para a explicação não ser pedida de novo ao modelo
  // quando o paciente vai de uma tela para outra.
  const [conversas, setConversas] = useState({});
  // true = o paciente clicou em "Enviar um arquivo" no catálogo (envio manual).
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  function guardarConversa(idCanonico, mensagens) {
    setConversas((atuais) => ({ ...atuais, [idCanonico]: mensagens }));
  }

  function novoEnvio() {
    setResultado(null);
    setExameAberto(null);
    setVendoTodas(false);
    setConversas({});
    setEnviandoArquivo(false);
  }

  // "Ver na tela de exames" no chat flutuante: o laudo lido lá passa a ser o da página.
  function verResultadoDoChat(resultadoDoChat) {
    novoEnvio();
    setResultado(resultadoDoChat);
  }

  let pagina;
  let tela;
  // contexto = qual conjunto de dicas o banner da Lumie mostra (dicas.js).
  let contexto = 'catalogo';
  if (!resultado && enviandoArquivo) {
    pagina = 'Enviar exame';
    tela = <TelaEnvio onResultado={setResultado} onVoltar={() => setEnviandoArquivo(false)} />;
  } else if (!resultado) {
    pagina = 'Escolher exame';
    tela = <TelaCatalogo onResultado={setResultado} onEnviarArquivo={() => setEnviandoArquivo(true)} />;
  } else if (exameAberto) {
    pagina = exameAberto.nome;
    contexto = 'chat';
    tela = (
      <TelaChat
        // key: trocar de exame recria a tela, com a conversa daquele exame.
        key={exameAberto.id_canonico}
        idLaudo={resultado.id_laudo}
        exame={exameAberto}
        conversaInicial={conversas[exameAberto.id_canonico]}
        onConversa={(mensagens) => guardarConversa(exameAberto.id_canonico, mensagens)}
        onVoltar={() => setExameAberto(null)}
        onNovoEnvio={novoEnvio}
      />
    );
  } else if (vendoTodas) {
    pagina = 'Explicações';
    contexto = 'chat';
    tela = (
      <TelaExplicacoes
        resultado={resultado}
        conversas={conversas}
        onConversa={guardarConversa}
        onAbrirChat={setExameAberto}
        onVoltar={() => setVendoTodas(false)}
        onNovoEnvio={novoEnvio}
      />
    );
  } else {
    pagina = 'Meus exames';
    contexto = 'exames';
    tela = (
      <TelaExames
        resultado={resultado}
        onExplicar={setExameAberto}
        onExplicarTodos={() => setVendoTodas(true)}
        onNovoEnvio={novoEnvio}
      />
    );
  }

  // Troca de tela com transição: a `key` muda a cada tela, então o React monta
  // um <div> novo e a animação de entrada (.tela no styles.css) roda de novo.
  // O chat usa o exame na chave: abrir outro exame também anima.
  const chaveDaTela = `${pagina}-${exameAberto?.id_canonico ?? ''}`;

  // Cada tela nova começa do topo (sem isso, a tela abre rolada no meio).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [chaveDaTela]);

  return (
    <Layout pagina={pagina} contexto={contexto} totalExames={resultado ? resultado.itens.length : 0}>
      <div key={chaveDaTela} className="tela">
        {tela}
      </div>
      {/* Só no catálogo: é a primeira coisa que o paciente vê. */}
      {!resultado && <BoasVindas />}
      {/* Fora da .tela: a animação de entrada usa transform, que quebraria o position: fixed. */}
      <ChatFlutuante onVerResultado={verResultadoDoChat} />
    </Layout>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
