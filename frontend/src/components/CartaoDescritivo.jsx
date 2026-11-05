// Uma linha por resultado DESCRITIVO (contrato §5.1, itens_descritivos):
// "Proteínas: Negativo", com a referência do laudo. O back só compara o texto
// com a referência; não há cor de faixa, alerta nem explicação por IA.
import Icone from './Icone.jsx';

export default function CartaoDescritivo({ item }) {
  const conforme = item.situacao === 'conforme_referencia';
  return (
    <article className={`exam-row cor-${conforme ? 'verde' : 'amarelo'}`}>
      <i className="lab">
        <Icone nome="frasco" />
      </i>

      <div className="exam-row-texto">
        <h3>{item.nome}</h3>
        <p className="exam-valor">{item.resultado}</p>
        <small>Referência do laudo: {item.referencia}</small>
      </div>

      {/* Texto sempre junto da cor (daltonismo). */}
      <span className={`selo cor-${conforme ? 'verde' : 'amarelo'}`}>
        {conforme ? 'Conforme a referência' : 'DIFERENTE DA REFERÊNCIA'}
      </span>
    </article>
  );
}
