// Moldura do app Lumie: barra lateral à esquerda, cabeçalho colorido com a
// trilha clicável ("Meus exames / Glicose") e o usuário, e o conteúdo da tela.
//
// Este módulo implementa SÓ "Meus exames". Os outros itens do menu, o usuário
// logado e o banner de lembretes são ILUSTRATIVOS: mostram como seria a
// plataforma completa, não levam a lugar nenhum e não há login de verdade.
// Os itens ilustrativos aparecem mais claros e não respondem ao clique.
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

function ItemMenu({ item, totalExames, onMeusExames }) {
  if (item.ativo) {
    // Botão de verdade: leva aos resultados (ou ao catálogo, sem laudo).
    return (
      <button type="button" className="nav-item selected" aria-current="page" onClick={onMeusExames}>
        <Icone nome={item.icone} /> {item.nome}
        {totalExames > 0 && <em>{totalExames}</em>}
      </button>
    );
  }
  // Ilustrativo: não leva a lugar nenhum. aria-disabled faz o leitor de tela
  // anunciar que não está disponível; o title explica no hover.
  return (
    <span className="nav-item inativo" aria-disabled="true" title="Disponível na plataforma completa">
      <Icone nome={item.icone} /> {item.nome}
    </span>
  );
}

// Trilha do cabeçalho ("Meus exames / Todas as explicações / Glicose"): cada
// nível anterior é clicável e volta àquele ponto; o último é a tela atual.
function Trilha({ itens }) {
  return (
    <nav className="trilha" aria-label="Você está em">
      <ol>
        {itens.map((item, i) => {
          const atual = i === itens.length - 1;
          return (
            <li key={item.rotulo}>
              {atual || !item.onClick ? (
                <span aria-current={atual ? 'page' : undefined}>{item.rotulo}</span>
              ) : (
                <button type="button" onClick={item.onClick}>
                  {item.rotulo}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function Layout({ trilha, contexto, totalExames, onMeusExames, children }) {
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
            <ItemMenu key={item.nome} item={item} totalExames={totalExames} onMeusExames={onMeusExames} />
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
          <div className="topbar-esquerda">
            <p className="topbar-saudacao">Olá, {USUARIO_DEMO.nome.split(' ')[0]}</p>
            <Trilha itens={trilha} />
          </div>
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
