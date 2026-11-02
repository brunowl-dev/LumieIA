// Ponto de entrada do front. O App guarda em qual tela o paciente está:
// sem resultado → tela de envio; com resultado → tela de exames (próximo passo).
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Cabecalho from './components/Cabecalho.jsx';
import TelaEnvio from './telas/TelaEnvio.jsx';
import './styles.css';

function App() {
  // resultado = resposta de POST /api/laudos (contrato §5.1), ou null.
  const [resultado, setResultado] = useState(null);

  return (
    <>
      <Cabecalho />
      <main className="conteudo">
        {resultado ? (
          // Provisório: a tela de exames entra no próximo passo.
          <section>
            <h1 className="titulo">Recebemos {resultado.itens.length} exame(s)</h1>
            <button type="button" className="botao botao-secundario" onClick={() => setResultado(null)}>
              Enviar outro exame
            </button>
          </section>
        ) : (
          <TelaEnvio onResultado={setResultado} />
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
