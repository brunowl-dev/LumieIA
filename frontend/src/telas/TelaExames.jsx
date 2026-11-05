// Tela 2 — resultado do laudo (contrato §5.1). Tudo aqui vem do pipeline, sem IA:
// o alerta prioritário aparece já nesta tela e não espera o paciente abrir o chat.
import AvisoMedico from '../components/AvisoMedico.jsx';
import CartaoDescritivo from '../components/CartaoDescritivo.jsx';
import CartaoExame from '../components/CartaoExame.jsx';
import Icone from '../components/Icone.jsx';

export default function TelaExames({ resultado, onExplicar, onExplicarTodos, onNovoEnvio }) {
  const { itens } = resultado;
  // Resultados descritivos ("Negativo"): vêm à parte, sem cor de faixa (contrato §5.1).
  const descritivos = resultado.itens_descritivos ?? [];
  const comExplicacao = itens.filter((item) => item.explicacao_disponivel).length;
  const examesEmAlerta = itens.filter((item) => item.alerta_prioritario);
  // Contagem para os quadros de resumo: só conta o que o back já classificou.
  const dentro = itens.filter((item) => item.classificacao === 'dentro').length;
  const fora = itens.length - dentro;

  return (
    <>
      <div className="exams-heading">
        <div>
          <p className="eyebrow">SEUS RESULTADOS</p>
          <h1>Meus exames</h1>
          <span>Cada valor aparece com a faixa de referência do seu laudo.</span>
        </div>
        <button type="button" className="upload" onClick={onNovoEnvio}>
          Escolher outro
          <br />
          exame →
        </button>
      </div>

      {examesEmAlerta.length > 0 && (
        <div className="alerta-prioritario" role="alert">
          <i>
            <Icone nome="alerta" />
          </i>
          <div>
            <strong>Atendimento prioritário</strong>
            <p>
              {examesEmAlerta.map((item) => item.nome).join(', ')}{' '}
              {examesEmAlerta.length > 1 ? 'estão' : 'está'} muito fora da faixa de referência e{' '}
              {examesEmAlerta.length > 1 ? 'merecem' : 'merece'} atenção prioritária. Procure um serviço de
              saúde o quanto antes.
            </p>
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat blue">
          <i><Icone nome="exames" /></i>
          <span>
            <small>EXAMES NO LAUDO</small>
            <strong>{itens.length}</strong>
          </span>
        </div>
        <div className="stat green">
          <i><Icone nome="escudo" /></i>
          <span>
            <small>DENTRO DA FAIXA</small>
            <strong>{dentro}</strong>
          </span>
        </div>
        <div className="stat amber">
          <i><Icone nome="tendencia" /></i>
          <span>
            <small>FORA DA FAIXA</small>
            <strong>{fora}</strong>
          </span>
        </div>
      </div>

      <div className="result-title">
        <div>
          <p className="eyebrow">LAUDO ENVIADO</p>
          <h2>Resultados identificados</h2>
        </div>
        {/* Com 2 ou mais exames explicáveis: todas as explicações numa tela só. */}
        {comExplicacao > 1 && (
          <button type="button" className="primary" onClick={onExplicarTodos}>
            <Icone nome="faisca" /> Explicar todos com IA
          </button>
        )}
      </div>

      <div className="exam-list">
        {itens.map((item) => (
          // Exame sem ficha na base tem id_canonico null; o nome serve de chave.
          <CartaoExame key={item.id_canonico ?? item.nome} item={item} onExplicar={onExplicar} />
        ))}
      </div>

      {/* Caso misto (contrato §2.4): o que não foi lido com segurança aparece só pelo nome, sem valor. */}
      {resultado.aviso_usuario && (
        <p className="aviso-nao-lidos" role="note">
          <Icone nome="alerta" /> {resultado.aviso_usuario}
          {resultado.itens_nao_lidos?.length > 0 && (
            <> Não lidos: {resultado.itens_nao_lidos.map((item) => item.nome).join(', ')}.</>
          )}
        </p>
      )}

      {descritivos.length > 0 && (
        <>
          <div className="result-title">
            <div>
              <p className="eyebrow">RESULTADOS DESCRITIVOS</p>
              <h2>Comparados com a referência do laudo</h2>
            </div>
          </div>
          <div className="exam-list">
            {descritivos.map((item, indice) => (
              // O mesmo nome pode aparecer em seções diferentes do laudo: o índice entra na chave.
              <CartaoDescritivo key={`${item.nome}-${indice}`} item={item} />
            ))}
          </div>
        </>
      )}

      <AvisoMedico />
    </>
  );
}
