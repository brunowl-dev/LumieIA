// Ponto de entrada do front. O App guarda em qual tela o paciente está:
// sem resultado → envio; com resultado → exames; "Explicar todos" → todas as
// explicações; com exame escolhido → chat do exame.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Layout from './components/Layout.jsx';
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

  function guardarConversa(idCanonico, mensagens) {
    setConversas((atuais) => ({ ...atuais, [idCanonico]: mensagens }));
  }

  function novoEnvio() {
    setResultado(null);
    setExameAberto(null);
    setVendoTodas(false);
    setConversas({});
  }

  let pagina;
  let tela;
  if (!resultado) {
    pagina = 'Enviar exame';
    tela = <TelaEnvio onResultado={setResultado} />;
  } else if (exameAberto) {
    pagina = exameAberto.nome;
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
    tela = (
      <TelaExames
        resultado={resultado}
        onExplicar={setExameAberto}
        onExplicarTodos={() => setVendoTodas(true)}
        onNovoEnvio={novoEnvio}
      />
    );
  }

  return (
    <Layout pagina={pagina} totalExames={resultado ? resultado.itens.length : 0}>
      {tela}
    </Layout>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
