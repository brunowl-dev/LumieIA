// Marca do Lumie no topo de todas as telas, no estilo do app (ícone ciano + nome azul).
export default function Cabecalho() {
  return (
    <header className="cabecalho">
      <span className="marca-icone" aria-hidden="true">✦</span>
      <div>
        <strong className="marca-nome">Lumie</strong>
        <small className="marca-sub">SUA SAÚDE EM UM SÓ LUGAR</small>
      </div>
    </header>
  );
}
