// Uma linha por exame na tela de exames (contrato §5.1), no formato das linhas
// de "Meus exames" do app Lumie: ícone redondo, nome e valor, selo e botão.
import Icone from './Icone.jsx';
import SeloStatus, { formatarNumero } from './SeloStatus.jsx';

export default function CartaoExame({ item, ordem = 0, onExplicar }) {
  return (
    <article className={`exam-row cor-${item.cor}`} style={{ '--ordem': ordem }}>
      <i className="lab">
        <Icone nome="frasco" />
      </i>

      <div className="exam-row-texto">
        <h3>{item.nome}</h3>
        <p className="exam-valor">
          {formatarNumero(item.valor)} <small>{item.unidade}</small>
        </p>
        {/* A faixa é a do PRÓPRIO laudo, exatamente como o laboratório escreveu. */}
        <small>Referência do laudo: {item.faixa_referencia.texto_original}</small>
      </div>

      <SeloStatus item={item} />

      {item.explicacao_disponivel ? (
        <button type="button" className="view-ocr" onClick={() => onExplicar(item)}>
          <Icone nome="faisca" /> Explicar com IA
        </button>
      ) : (
        <span className="sem-explicacao">Ainda não temos explicação para este exame</span>
      )}
    </article>
  );
}
