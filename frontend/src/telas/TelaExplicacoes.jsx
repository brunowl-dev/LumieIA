// Tela "Todas as explicações": a explicação de cada exame do laudo, uma embaixo
// da outra (mais perto da Figura 3 do artigo, em que a explicação aparece logo
// abaixo do resultado). Não há rota nova: é a mesma POST /api/explicacoes do
// chat, chamada uma vez por exame, e cada resposta passa pela segurança no back.
//
// Uma de cada vez, não todas juntas: o limite do plano gratuito do modelo é
// desconhecido. Cada explicação aparece assim que fica pronta.
//
// A explicação fica guardada em `conversas` (no App): ao abrir o chat do exame,
// ele começa com ESTE texto, sem pedir outro ao modelo (o back guarda no
// histórico do chat a última explicação gerada).
import { useEffect, useState } from 'react';
import { pedirExplicacao } from '../api.js';
import AvisoMedico from '../components/AvisoMedico.jsx';
import { BalaoExplicacao } from '../components/Explicacao.jsx';
import Icone from '../components/Icone.jsx';
import MensagemErro from '../components/MensagemErro.jsx';
import SeloStatus, { formatarNumero } from '../components/SeloStatus.jsx';

export default function TelaExplicacoes({ resultado, conversas, onConversa, onAbrirChat, onVoltar, onNovoEnvio }) {
  const disponiveis = resultado.itens.filter((item) => item.explicacao_disponivel);
  const semExplicacao = resultado.itens.filter((item) => !item.explicacao_disponivel);
  // Erro de cada exame que falhou, por id_canonico.
  const [erros, setErros] = useState({});
  // Exame sendo explicado agora (para o "carregando"), ou null.
  const [explicandoAgora, setExplicandoAgora] = useState(null);
  // Muda → percorre de novo os exames que ainda não têm explicação ("Tentar de novo").
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    // "cancelado" para o laço se o paciente sair da tela no meio.
    let cancelado = false;
    const pendentes = disponiveis.filter((item) => !conversas[item.id_canonico]);
    (async () => {
      for (const item of pendentes) {
        if (cancelado) return;
        setExplicandoAgora(item.id_canonico);
        const resposta = await pedirExplicacao(resultado.id_laudo, item.id_canonico);
        if (cancelado) return;
        if (resposta.status === 'ok') {
          onConversa(item.id_canonico, [{ autor: 'lumie', explicacao: resposta.explicacao, origem: resposta.origem_texto }]);
          setErros((atuais) => ({ ...atuais, [item.id_canonico]: null }));
        } else {
          setErros((atuais) => ({ ...atuais, [item.id_canonico]: resposta.erro }));
          // Sessão expirada vale para todos: não adianta pedir os próximos.
          if (resposta.erro.codigo === 'SESSAO_EXPIRADA') break;
        }
      }
      if (!cancelado) setExplicandoAgora(null);
    })();
    return () => {
      cancelado = true;
    };
    // Só a rodada dispara o laço; conversas é lido no início de cada rodada.
  }, [rodada]);

  function acaoDoErro(erro) {
    if (erro.codigo === 'SESSAO_EXPIRADA') return { textoAcao: 'Enviar o laudo de novo', onAcao: onNovoEnvio };
    return { textoAcao: 'Tentar de novo', onAcao: () => setRodada((n) => n + 1) };
  }

  return (
    <>
      <div className="exams-heading">
        <div>
          <p className="eyebrow">EXPLICAR COM IA</p>
          <h1>Todas as explicações</h1>
          <span>Uma explicação para cada exame do seu laudo. Para tirar dúvidas, abra o chat do exame.</span>
        </div>
        <button type="button" className="secondary" onClick={onVoltar}>
          ← Voltar aos resultados
        </button>
      </div>

      <div className="explicacoes-lista">
        {disponiveis.map((item) => {
          const conversa = conversas[item.id_canonico];
          const erro = erros[item.id_canonico];
          const esperando = !conversa && !erro;
          return (
            <section key={item.id_canonico} className="explicacao-exame" aria-label={`Explicação de ${item.nome}`}>
              <div className={`exam-row cor-${item.cor}`}>
                <i className="lab">
                  <Icone nome="frasco" />
                </i>
                <div className="exam-row-texto">
                  <h3>{item.nome}</h3>
                  <p className="exam-valor">
                    {formatarNumero(item.valor)} <small>{item.unidade}</small>
                  </p>
                  <small>Referência do laudo: {item.faixa_referencia.texto_original}</small>
                </div>
                <SeloStatus item={item} />
                {conversa && (
                  <button type="button" className="view-ocr" onClick={() => onAbrirChat(item)}>
                    <Icone nome="faisca" /> Tirar dúvidas
                  </button>
                )}
              </div>

              <div aria-live="polite">
                {conversa && <BalaoExplicacao explicacao={conversa[0].explicacao} origem={conversa[0].origem} />}
                {esperando && (
                  <div className="carregando" role="status">
                    {explicandoAgora === item.id_canonico && <div className="girando" aria-hidden="true" />}
                    <div>
                      <strong>{explicandoAgora === item.id_canonico ? 'Preparando a explicação...' : 'Na fila...'}</strong>
                      <p>A resposta passa por uma verificação de segurança antes de aparecer.</p>
                    </div>
                  </div>
                )}
                {erro && <MensagemErro erro={erro} {...acaoDoErro(erro)} />}
              </div>
            </section>
          );
        })}
      </div>

      {semExplicacao.length > 0 && (
        <p className="sem-explicacao-lista">
          Ainda não temos explicação para: {semExplicacao.map((item) => item.nome).join(', ')}.
        </p>
      )}

      <AvisoMedico />
    </>
  );
}
