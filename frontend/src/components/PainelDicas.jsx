// Banner "Dica da Lumie": o mascote (a gotinha) com uma dica por vez, que troca
// sozinha a cada INTERVALO_MS. As setas passam à mão; passar o mouse ou focar
// pausa a troca (dá tempo de ler). As dicas vêm de dicas.js, conforme a tela.
import { useEffect, useState } from 'react';
import { DICAS } from '../dicas.js';

const INTERVALO_MS = 9000;

export default function PainelDicas({ contexto }) {
  const dicas = DICAS[contexto] ?? DICAS.catalogo;
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);

  // Troca automática. O intervalo é refeito quando muda a tela ou a pausa.
  useEffect(() => {
    setAtual(0);
  }, [contexto]);
  useEffect(() => {
    if (pausado) return undefined;
    const id = setInterval(() => setAtual((n) => (n + 1) % dicas.length), INTERVALO_MS);
    return () => clearInterval(id);
  }, [pausado, dicas.length, contexto]);

  const passar = (passo) => setAtual((n) => (n + passo + dicas.length) % dicas.length);
  // "% dicas.length": ao trocar de tela, `atual` ainda pode ser o da lista anterior
  // (ex.: 4ª dica dos exames → chat, que tem 3) por uma renderização.
  const indice = atual % dicas.length;
  const dica = dicas[indice];

  return (
    <aside
      className="painel-dicas"
      aria-label="Dicas da Lumie"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <img className="mascote-dicas" src="/mascote.png" alt="" aria-hidden="true" />
      <p className="eyebrow">DICA DA LUMIE</p>
      {/* key: trocar de dica refaz a animação de entrada do texto. */}
      <div key={`${contexto}-${indice}`} className="dica-texto">
        <strong>{dica.titulo}</strong>
        <p>{dica.texto}</p>
      </div>
      <div className="dica-controles">
        <button type="button" onClick={() => passar(-1)} aria-label="Dica anterior">
          ‹
        </button>
        <span className="dica-pontos" aria-hidden="true">
          {dicas.map((d, i) => (
            <i key={d.titulo} className={i === indice ? 'ativo' : ''} />
          ))}
        </span>
        <button type="button" onClick={() => passar(1)} aria-label="Próxima dica">
          ›
        </button>
      </div>
      <span className="visualmente-oculto">
        Dica {indice + 1} de {dicas.length}
      </span>
    </aside>
  );
}
