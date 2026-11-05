// A explicação em 5 partes, sempre na ordem do artigo (contrato §5.2).
// Usada no chat do exame e na tela "Todas as explicações".
import Icone from './Icone.jsx';

// Títulos das partes 1 a 4; a parte 5 (aviso) fecha a mensagem sem título.
const PARTES = [
  ['o_que_avalia', 'O que o exame avalia'],
  ['valor_e_posicao', 'Seu resultado'],
  ['significado', 'O que isso significa'],
  ['especialidade', 'Especialidade indicada'],
];

// Parte vazia (null) não aparece.
export function Explicacao({ explicacao }) {
  return (
    <>
      {PARTES.map(
        ([campo, titulo]) =>
          explicacao[campo] && (
            <div key={campo} className="parte">
              <strong>{titulo}</strong>
              <p>{explicacao[campo]}</p>
            </div>
          ),
      )}
      <p className="parte-aviso">{explicacao.aviso}</p>
    </>
  );
}

// Transparência: a segurança reprovou as respostas do modelo e o back montou
// um texto padrão, sem IA (contrato §8).
export function NotaMensagemPadrao({ origem }) {
  if (origem !== 'mensagem_padrao') return null;
  return (
    <p className="origem-padrao">
      Esta é uma resposta padrão: a explicação gerada pela IA não passou na nossa verificação de segurança.
    </p>
  );
}

// Balão da Lumie com a explicação (1ª mensagem do chat).
export function BalaoExplicacao({ explicacao, origem }) {
  return (
    <div className="balao balao-lumie">
      <span className="balao-autor">
        <Icone nome="faisca" /> Lumie
      </span>
      <Explicacao explicacao={explicacao} />
      <NotaMensagemPadrao origem={origem} />
    </div>
  );
}
