// Selo de status de um exame, usado na lista de exames e no chat.
// O front NÃO classifica: "cor", "classificacao" e "alerta_prioritario" chegam
// prontos do back. Aqui só traduzimos esses valores em texto.
import Icone from './Icone.jsx';

// O selo sempre traz texto, nunca só a cor (daltonismo).
const ROTULOS = {
  dentro: 'Dentro da faixa',
  acima: 'Acima da faixa',
  abaixo: 'Abaixo da faixa',
};

export default function SeloStatus({ item }) {
  return (
    <span className={`selo cor-${item.cor}`}>
      {item.alerta_prioritario && <Icone nome="alerta" />}
      {ROTULOS[item.classificacao]}
    </span>
  );
}

// O JSON usa ponto decimal (0.9); o paciente lê com vírgula (0,9).
export const formatarNumero = (numero) => numero.toLocaleString('pt-BR');
