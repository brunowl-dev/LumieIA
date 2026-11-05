// Moldura do app Lumie: barra lateral à esquerda, barra superior com o caminho
// ("Sua saúde / Meus exames") e o usuário, e o conteúdo da tela.
//
// Este módulo implementa SÓ "Meus exames". Os outros itens do menu, o usuário
// logado e o banner de lembretes são ILUSTRATIVOS: mostram como seria a
// plataforma completa, não levam a lugar nenhum e não há login de verdade.
// Os itens têm a etiqueta "em breve" para ninguém achar que já funcionam
// (ex.: lembretes estão no artigo, mas não no protótipo).
import Icone from './Icone.jsx';
import PainelDicas from './PainelDicas.jsx';

// Menu da plataforma completa. Só "Meus exames" existe neste protótipo.
const MENU_PRINCIPAL = [
  { icone: 'inicio', nome: 'Início' },
  { icone: 'exames', nome: 'Meus exames', ativo: true },
  { icone: 'calendario', nome: 'Consultas' },
  { icone: 'pilula', nome: 'Medicações' },
  { icone: 'sino', nome: 'Lembretes' },
  { icone: 'medico', nome: 'Meus médicos' },
  { icone: 'historico', nome: 'Histórico' },
];
const MENU_CONTA = [
  { icone: 'perfil', nome: 'Meu perfil' },
  { icone: 'engrenagem', nome: 'Configurações' },
];

// Usuário FICTÍCIO, só para a tela parecer a de uma conta logada. Este nome não
// existe nos laudos, não vai ao back e nunca chega à inteligência artificial.
const USUARIO_DEMO = { nome: 'Ana Lima', iniciais: 'AL' };

function ItemMenu({ item, totalExames }) {
  if (item.ativo) {
    return (
      <span className="nav-item selected" aria-current="page">
        <Icone nome={item.icone} /> {item.nome}
        {totalExames > 0 && <em>{totalExames}</em>}
      </span>
    );
  }
  // aria-disabled: o leitor de tela anuncia que o item não está disponível.
  return (
    <span className="nav-item inativo" aria-disabled="true" title="Disponível na plataforma completa">
      <Icone nome={item.icone} /> {item.nome}
      <small className="em-breve">em breve</small>
    </span>
  );
}

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
        <nav aria-label="Menu principal">
          {MENU_PRINCIPAL.map((item) => (
            <ItemMenu key={item.nome} item={item} totalExames={totalExames} />
          ))}
        </nav>

        <p className="menu-label">MINHA CONTA</p>
        <nav aria-label="Minha conta">
          {MENU_CONTA.map((item) => (
            <ItemMenu key={item.nome} item={item} />
          ))}
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
          <div className="usuario-demo">
            <span className="sino-demo" aria-hidden="true">
              <Icone nome="sino" />
              <i />
            </span>
            <span className="avatar-usuario" aria-hidden="true">{USUARIO_DEMO.iniciais}</span>
            <span className="usuario-texto">
              <strong>{USUARIO_DEMO.nome}</strong>
              <small>Conta de demonstração</small>
            </span>
          </div>
        </header>
        {/* Tela larga: conteúdo + coluna lateral à direita. Estreita: a coluna vai para baixo. */}
        <div className="conteudo-com-dicas">
          <div className="conteudo-principal">{children}</div>
          <div className="coluna-lateral">
            <PainelDicas contexto={contexto} />
            <aside className="banner-lembretes" aria-label="Novidade da plataforma">
              <span className="banner-icone" aria-hidden="true">
                <Icone nome="sino" />
              </span>
              <small className="em-breve">em breve</small>
              <strong>Lembretes de medicação e consultas</strong>
              <p>Cadastre seus horários e a Lumie avisa você. Os horários e as doses vêm sempre do que você cadastrou.</p>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
