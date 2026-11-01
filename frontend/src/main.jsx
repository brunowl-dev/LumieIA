// Esqueleto mínimo do front: mostra o nome do projeto e testa a ligação com o
// backend. A chamada usa caminho RELATIVO (/api/...): o navegador pede ao mesmo
// endereço do front e o nginx repassa ao backend, então não há CORS.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  const [backend, setBackend] = useState('verificando...');

  useEffect(() => {
    fetch('/api/saude')
      .then((res) => res.json())
      .then((dados) => setBackend(dados.status === 'ok' ? 'conectado' : 'resposta inesperada'))
      .catch(() => setBackend('sem conexão'));
  }, []);

  return (
    <main>
      <h1>Lumie</h1>
      <p>Módulo de IA — interpretação de exames em linguagem simples.</p>
      <p className="status">Backend: {backend}</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
