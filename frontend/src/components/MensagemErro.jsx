// Mostra um erro do contrato (§7): o texto vem pronto do back (mensagem_usuario);
// o front só escolhe o botão de ação. Usado nas três telas.
export default function MensagemErro({ erro, textoAcao, onAcao }) {
  return (
    <div className="mensagem-erro" role="alert">
      <p>
        <strong>Ops! </strong>
        {erro.mensagem_usuario}
      </p>
      {onAcao && (
        <button type="button" className="botao botao-secundario" onClick={onAcao}>
          {textoAcao}
        </button>
      )}
    </div>
  );
}
