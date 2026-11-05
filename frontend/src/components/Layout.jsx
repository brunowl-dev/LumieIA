// Moldura do app Lumie: barra lateral à esquerda, barra superior com o caminho
// ("Sua saúde / Meus exames") e o conteúdo da tela. Mesma estrutura do design.
// A barra lateral só tem "Meus exames": é o único item que este módulo implementa.
import Icone from './Icone.jsx';
import PainelDicas from './PainelDicas.jsx';

export default function Layout({ pagina, contexto, totalExames, children }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>
            <strong>Lumie</strong>
            <small>SUA SAÚDE EM UM SÓ LUGAR</small>
          </span>
        </div>
        <p className="menu-label">MENU PRINCIPAL</p>
        <nav>
          <span className="nav-item selected">
            <Icone nome="exames" /> Meus exames
            {totalExames > 0 && <em>{totalExames}</em>}
          </span>
        </nav>
        <div className="help">
          <strong>
            Seus dados protegidos <b><Icone nome="cadeado" /></b>
          </strong>
          <p>A inteligência artificial recebe só os valores dos exames, nunca seu nome ou documentos.</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <p>
            Sua saúde <span>/</span> <b>{pagina}</b>
          </p>
        </header>
        {/* Tela larga: conteúdo + coluna de dicas à direita. Estreita: as dicas vão para baixo. */}
        <div className="conteudo-com-dicas">
          <div className="conteudo-principal">{children}</div>
          <PainelDicas contexto={contexto} />
        </div>
      </section>
    </div>
  );
}
