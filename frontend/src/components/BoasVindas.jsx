// Pop-up de boas-vindas no canto da tela, com o mascote. Aparece uma vez por
// sessão do navegador: depois de "Entendi", não volta até a aba ser fechada.
// sessionStorage pode falhar (aba anônima, bloqueio): por isso o try/catch;
// sem ele, o pop-up só aparece de novo ao recarregar, o que não atrapalha.
import { useEffect, useState } from 'react';

const CHAVE = 'lumie-boas-vindas-vista';

function jaViu() {
  try {
    return sessionStorage.getItem(CHAVE) === 'sim';
  } catch {
    return false;
  }
}

export default function BoasVindas() {
  const [visivel, setVisivel] = useState(false);

  // Entra um pouco depois da página, para não competir com a entrada da tela.
  useEffect(() => {
    if (jaViu()) return undefined;
    const id = setTimeout(() => setVisivel(true), 700);
    return () => clearTimeout(id);
  }, []);

  function fechar() {
    setVisivel(false);
    try {
      sessionStorage.setItem(CHAVE, 'sim');
    } catch {
      // sem armazenamento: tudo bem, só fecha
    }
  }

  if (!visivel) return null;
  return (
    <div className="boas-vindas" role="dialog" aria-labelledby="boas-vindas-titulo">
      <img src="/mascote.png" alt="" aria-hidden="true" />
      <div>
        <strong id="boas-vindas-titulo">Oi! Eu sou a Lumie.</strong>
        <p>
          Escolha um laudo de demonstração para ver como eu leio o resultado e explico cada exame em linguagem
          simples.
        </p>
        <button type="button" className="primary" onClick={fechar}>
          Entendi
        </button>
      </div>
    </div>
  );
}
