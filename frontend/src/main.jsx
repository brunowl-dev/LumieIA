// Ponto de entrada do front. O App guarda em qual tela o paciente está:
// sem resultado → envio; com resultado → exames; com exame escolhido → chat (próximo passo).
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Layout from './components/Layout.jsx';
import TelaEnvio from './telas/TelaEnvio.jsx';
import TelaExames from './telas/TelaExames.jsx';
import './styles.css';

function App() {
  // resultado = resposta de POST /api/laudos (contrato §5.1), ou null.
  const [resultado, setResultado] = useState(null);
  // exameAberto = item cujo botão "Explicar com IA" foi clicado, ou null.
  const [exameAberto, setExameAberto] = useState(null);

  function novoEnvio() {
    setResultado(null);
    setExameAberto(null);
  }

  let pagina;
  let tela;
  if (!resultado) {
    pagina = 'Enviar exame';
    tela = <TelaEnvio onResultado={setResultado} />;
  } else if (exameAberto) {
    // Provisório: o chat do exame entra no próximo passo.
    pagina = exameAberto.nome;
    tela = (
      <div className="exams-heading">
        <h1>Chat: {exameAberto.nome}</h1>
        <button type="button" className="secondary" onClick={() => setExameAberto(null)}>
          ← Voltar aos resultados
        </button>
      </div>
    );
  } else {
    pagina = 'Meus exames';
    tela = <TelaExames resultado={resultado} onExplicar={setExameAberto} onNovoEnvio={novoEnvio} />;
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
