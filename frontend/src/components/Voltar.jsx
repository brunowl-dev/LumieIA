// "Voltar" padronizado: sempre no alto, à esquerda, acima do título da tela.
// Mesmo lugar e mesmo visual em todas as telas internas, para o paciente achar
// a saída sem procurar (convenção de navegação: voltar fica no topo à esquerda;
// o canto direito do título é das ações da tela).
export default function Voltar({ onClick, children, disabled = false }) {
  return (
    <button type="button" className="voltar" onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">←</span> {children}
    </button>
  );
}
