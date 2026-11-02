// Uma linha por exame na tela de exames (contrato §5.1), no formato das linhas
// de "Meus exames" do app Lumie: ícone redondo, nome e valor, selo e botão.
// O front NÃO classifica: "cor", "classificacao" e "alerta_prioritario" chegam
// prontos do back. Aqui só traduzimos esses valores em texto.
import Icone from './Icone.jsx';

// O selo sempre traz texto, nunca só a cor (daltonismo).
const ROTULOS = {
  dentro: 'Dentro da faixa',
  acima: 'Acima da faixa',
  abaixo: 'Abaixo da faixa',
};

// O JSON usa ponto decimal (0.9); o paciente lê com vírgula (0,9).
const formatarNumero = (numero) => numero.toLocaleString('pt-BR');

export default function CartaoExame({ item, onExplicar }) {
  return (
    <article className={`exam-row cor-${item.cor}`}>
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

      <span className={`selo cor-${item.cor}`}>
        {item.alerta_prioritario && <Icone nome="alerta" />}
        {ROTULOS[item.classificacao]}
      </span>

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
