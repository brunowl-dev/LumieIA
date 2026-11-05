// Chat flutuante com a Lumie: um botão com a gotinha no canto da tela abre uma
// conversa lateral. Nela o paciente escolhe um laudo de demonstração ou anexa o
// seu, autoriza a leitura, vê os resultados e pede a explicação de cada exame;
// depois tira dúvidas sobre o exame escolhido.
//
// Não há rota nova: são as MESMAS portas do contrato (POST /api/laudos,
// /api/explicacoes e /api/chat), então a mesma camada de segurança vale aqui.
// O back só conversa sobre UM exame por vez (o histórico é por exame e começa
// pela explicação): por isso o campo de texto só libera depois de uma explicação.
// Texto digitado antes disso recebe uma resposta FIXA do front, sem IA.
import { useEffect, useRef, useState } from 'react';
import { enviarDuvida, enviarLaudo, pedirExplicacao } from '../api.js';
import { LAUDOS_DEMO, carregarLaudoDemo } from '../laudosDemo.js';
import { AutorLumie, Explicacao, NotaMensagemPadrao } from './Explicacao.jsx';
import Icone from './Icone.jsx';
import SeloStatus, { formatarNumero } from './SeloStatus.jsx';

// Mesmas regras da tela de envio (o back confere de novo).
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
const TAMANHO_MAXIMO_MB = 10;

const SAUDACAO = {
  autor: 'lumie',
  texto: 'Oi! Eu sou a Lumie. Escolha um laudo de demonstração ou anexe o seu, e eu mostro os resultados e explico cada exame em linguagem simples.',
};
const CONSENTIMENTO =
  'Antes de ler, preciso da sua autorização: vou ler este exame para mostrar os resultados e, quando você pedir, gerar explicações com inteligência artificial. Seu nome e seus documentos não são enviados à inteligência artificial.';
const SEM_EXAME =
  'Para eu responder, escolha primeiro um laudo e peça a explicação de um exame. Eu converso sobre um exame de cada vez.';

let proximoId = 1;
const comId = (mensagem) => ({ id: proximoId++, ...mensagem });

export default function ChatFlutuante({ onVerResultado }) {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState(() => [comId(SAUDACAO)]);
  // Etapa da conversa: decide quais botões aparecem embaixo da última mensagem.
  // inicio → consentimento → lendo → resultado → (explicando) → conversa
  const [etapa, setEtapa] = useState('inicio');
  const [pendente, setPendente] = useState(null); // { arquivo, nome } aguardando autorização
  const [resultado, setResultado] = useState(null); // resposta de POST /api/laudos
  const [exameAtual, setExameAtual] = useState(null); // exame em conversa
  const [esperando, setEsperando] = useState(false); // três pontinhos
  const [texto, setTexto] = useState('');
  const fim = useRef(null);
  const campo = useRef(null);
  const inputArquivo = useRef(null);

  const adicionar = (...novas) => setMensagens((atuais) => [...atuais, ...novas.map(comId)]);
  // Para onde voltar se a leitura for recusada ou falhar: a conversa em curso não se perde.
  const etapaDeVolta = () => (exameAtual ? 'conversa' : resultado ? 'resultado' : 'inicio');

  // Sempre mostra a última mensagem.
  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, esperando, etapa, aberto]);

  // Esc fecha; ao abrir, o foco vai para o campo de texto.
  useEffect(() => {
    if (!aberto) return undefined;
    campo.current?.focus();
    const tecla = (e) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto]);

  // --- Passo 1: escolher ou anexar um laudo ---------------------------------
  async function escolherDemo(laudo) {
    adicionar({ autor: 'paciente', anexo: { nome: laudo.titulo, detalhe: laudo.caso, tipo: laudo.tipo, url: `/laudos/${laudo.arquivo}` } });
    setEsperando(true);
    try {
      const arquivo = await carregarLaudoDemo(laudo);
      pedirConsentimento(arquivo, laudo.titulo);
    } catch {
      setEsperando(false);
      adicionar({ autor: 'lumie', erro: 'Não consegui abrir este laudo de demonstração. Tente outro.' });
    }
  }

  function anexar(evento) {
    const arquivo = evento.target.files[0];
    evento.target.value = ''; // permite anexar o mesmo arquivo de novo
    if (!arquivo) return;
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      adicionar({ autor: 'lumie', erro: 'Envie apenas PDF, JPG ou PNG.' });
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      adicionar({ autor: 'lumie', erro: `O arquivo deve ter no máximo ${TAMANHO_MAXIMO_MB} MB.` });
      return;
    }
    // Endereço local (blob:) só para o paciente abrir o que anexou; nada sai do navegador ainda.
    const tipo = arquivo.type === 'application/pdf' ? 'pdf' : 'foto';
    adicionar({ autor: 'paciente', anexo: { nome: arquivo.name, detalhe: tipo === 'pdf' ? 'PDF' : 'Foto', tipo, url: URL.createObjectURL(arquivo) } });
    setEsperando(true);
    pedirConsentimento(arquivo, arquivo.name);
  }

  // --- Passo 2: consentimento (o artigo exige antes de tratar o exame) -------
  function pedirConsentimento(arquivo, nome) {
    setTimeout(() => {
      setEsperando(false);
      setPendente({ arquivo, nome });
      setEtapa('consentimento');
      adicionar({ autor: 'lumie', texto: CONSENTIMENTO });
    }, 500);
  }

  function recusar() {
    adicionar({ autor: 'paciente', texto: 'Agora não' }, { autor: 'lumie', texto: 'Tudo bem, não li o laudo. Quando quiser, escolha outro ou anexe um arquivo.' });
    setPendente(null);
    setEtapa(etapaDeVolta());
  }

  // --- Passo 3: leitura (POST /api/laudos, sem IA) ---------------------------
  async function autorizar() {
    adicionar({ autor: 'paciente', texto: 'Autorizo' });
    setEtapa('lendo');
    setEsperando(true);
    const resposta = await enviarLaudo(pendente.arquivo);
    setEsperando(false);
    setPendente(null);
    if (resposta.status !== 'ok') {
      adicionar({ autor: 'lumie', erro: resposta.erro.mensagem_usuario });
      setEtapa(etapaDeVolta());
      return;
    }
    setResultado(resposta);
    setExameAtual(null);
    setEtapa('resultado');
    adicionar({ autor: 'lumie', resultado: resposta });
  }

  // --- Passo 4: explicação de um exame (POST /api/explicacoes) ---------------
  async function explicar(item) {
    adicionar({ autor: 'paciente', texto: `Explique ${item.nome}` });
    setEtapa('explicando');
    setEsperando(true);
    const resposta = await pedirExplicacao(resultado.id_laudo, item.id_canonico);
    setEsperando(false);
    if (resposta.status !== 'ok') {
      adicionar({ autor: 'lumie', erro: resposta.erro.mensagem_usuario });
      setEtapa(exameAtual ? 'conversa' : 'resultado');
      return;
    }
    setExameAtual(item);
    setEtapa('conversa');
    adicionar({ autor: 'lumie', explicacao: resposta.explicacao, origem: resposta.origem_texto, exame: item.nome });
  }

  // --- Passo 5: dúvidas sobre o exame atual (POST /api/chat) -----------------
  async function enviarTexto(evento) {
    evento.preventDefault();
    const mensagem = texto.trim();
    if (!mensagem || esperando) return;
    setTexto('');
    adicionar({ autor: 'paciente', texto: mensagem });
    if (!exameAtual) {
      // Sem exame escolhido não há para onde mandar: resposta fixa, sem IA.
      setTimeout(() => adicionar({ autor: 'lumie', texto: SEM_EXAME }), 400);
      return;
    }
    setEsperando(true);
    const resposta = await enviarDuvida(resultado.id_laudo, exameAtual.id_canonico, mensagem);
    setEsperando(false);
    if (resposta.status === 'ok') adicionar({ autor: 'lumie', texto: resposta.resposta, origem: resposta.origem_texto });
    else adicionar({ autor: 'lumie', erro: resposta.erro.mensagem_usuario });
  }

  function recomecar() {
    setResultado(null);
    setExameAtual(null);
    setPendente(null);
    setEtapa('inicio');
    adicionar({ autor: 'lumie', texto: 'Vamos ver outro laudo. Qual você quer?' });
  }

  // --- Botões de resposta rápida, conforme a etapa ---------------------------
  function acoes() {
    if (esperando) return null;
    if (etapa === 'inicio') {
      return (
        <>
          {LAUDOS_DEMO.map((laudo) => (
            <button key={laudo.arquivo} type="button" className="chip" onClick={() => escolherDemo(laudo)}>
              <Icone nome={laudo.tipo === 'foto' ? 'camera' : 'documento'} /> {laudo.titulo}
              <small>{laudo.caso}</small>
            </button>
          ))}
          <button type="button" className="chip chip-destaque" onClick={() => inputArquivo.current?.click()}>
            <Icone nome="documento" /> Anexar um laudo
          </button>
        </>
      );
    }
    if (etapa === 'consentimento') {
      return (
        <>
          <button type="button" className="chip chip-destaque" onClick={autorizar}>Autorizo</button>
          <button type="button" className="chip" onClick={recusar}>Agora não</button>
        </>
      );
    }
    if (etapa === 'resultado' || etapa === 'conversa') {
      const explicaveis = resultado.itens.filter((i) => i.explicacao_disponivel && i.id_canonico !== exameAtual?.id_canonico);
      return (
        <>
          {explicaveis.map((item) => (
            <button key={item.id_canonico} type="button" className="chip" onClick={() => explicar(item)}>
              <Icone nome="faisca" /> Explicar {item.nome}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() => {
              onVerResultado(resultado);
              setAberto(false);
            }}
          >
            Ver na tela de exames
          </button>
          <button type="button" className="chip" onClick={recomecar}>Outro laudo</button>
        </>
      );
    }
    return null;
  }

  const placeholder = exameAtual ? `Pergunte sobre ${exameAtual.nome}...` : 'Escolha um laudo para começar...';

  return (
    <>
      <button
        type="button"
        className={`chat-fab${aberto ? ' aberto' : ''}`}
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="chat-lateral"
        aria-label={aberto ? 'Fechar conversa com a Lumie' : 'Conversar com a Lumie'}
      >
        <img src="/mascote.png" alt="" aria-hidden="true" />
        <span className="chat-fab-rotulo" aria-hidden="true">Fale com a Lumie</span>
      </button>

      {/* Fechado, o painel fica fora da tela e com visibility: hidden (styles.css):
          some também do teclado e do leitor de tela, mas ainda pode deslizar. */}
      <aside id="chat-lateral" className={`chat-lateral${aberto ? ' aberto' : ''}`} aria-label="Conversa com a Lumie">
        <header className="chat-lateral-topo">
          <img src="/mascote.png" alt="" aria-hidden="true" />
          <div>
            <strong>Lumie</strong>
            <small>Explica seus exames · não substitui avaliação médica</small>
          </div>
          <button type="button" className="chat-fechar" onClick={() => setAberto(false)} aria-label="Fechar conversa">
            ×
          </button>
        </header>

        <div className="chat-lateral-mensagens" aria-live="polite">
          {mensagens.map((m) => (
            <Mensagem key={m.id} mensagem={m} />
          ))}
          {esperando && (
            <p className="balao balao-lumie digitando" role="status">
              <span className="pontinhos" aria-hidden="true">
                <i /> <i /> <i />
              </span>
              <span className="visualmente-oculto">Lumie está escrevendo...</span>
            </p>
          )}
          <div className="chat-acoes">{acoes()}</div>
          <div ref={fim} />
        </div>

        <form className="chat-lateral-campo" onSubmit={enviarTexto}>
          <button type="button" className="chat-anexar" onClick={() => inputArquivo.current?.click()} aria-label="Anexar um laudo" disabled={esperando}>
            <Icone nome="documento" />
          </button>
          <label htmlFor="chat-lateral-texto" className="visualmente-oculto">Mensagem para a Lumie</label>
          <input
            id="chat-lateral-texto"
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            autoComplete="off"
          />
          <button type="submit" className="primary" disabled={!texto.trim() || esperando}>
            Enviar
          </button>
          <input ref={inputArquivo} type="file" accept={TIPOS_ACEITOS.join(',')} onChange={anexar} hidden />
        </form>
      </aside>
    </>
  );
}

// Uma mensagem da conversa. Formatos: texto, anexo, erro, resultado do laudo ou explicação.
function Mensagem({ mensagem: m }) {
  if (m.autor === 'paciente') {
    if (m.anexo) {
      return (
        <a className="balao balao-paciente balao-anexo" href={m.anexo.url} target="_blank" rel="noopener noreferrer">
          <Icone nome={m.anexo.tipo === 'foto' ? 'camera' : 'documento'} />
          <span>
            <strong>{m.anexo.nome}</strong>
            <small>{m.anexo.detalhe} · abrir ↗</small>
          </span>
        </a>
      );
    }
    return <p className="balao balao-paciente">{m.texto}</p>;
  }

  if (m.erro) {
    return (
      <div className="balao balao-lumie balao-erro" role="alert">
        <AutorLumie />
        <p>{m.erro}</p>
      </div>
    );
  }

  if (m.resultado) {
    const { itens, aviso_usuario: aviso } = m.resultado;
    const emAlerta = itens.filter((i) => i.alerta_prioritario);
    return (
      <div className="balao balao-lumie">
        <AutorLumie />
        <p>Li o seu laudo. Encontrei {itens.length} {itens.length === 1 ? 'exame' : 'exames'}:</p>
        {emAlerta.length > 0 && (
          <p className="chat-alerta" role="alert">
            <Icone nome="alerta" /> {emAlerta.map((i) => i.nome).join(', ')} {emAlerta.length > 1 ? 'merecem' : 'merece'} atenção
            prioritária. Procure um serviço de saúde o quanto antes.
          </p>
        )}
        <ul className="chat-resultados">
          {itens.map((item) => (
            <li key={item.id_canonico ?? item.nome}>
              <span>
                <strong>{item.nome}</strong>
                <small>
                  {formatarNumero(item.valor)} {item.unidade} · ref. {item.faixa_referencia.texto_original}
                </small>
              </span>
              <SeloStatus item={item} />
            </li>
          ))}
        </ul>
        {aviso && <p className="chat-aviso">{aviso}</p>}
        <p>Quer que eu explique algum? Toque num exame abaixo.</p>
      </div>
    );
  }

  return (
    <div className="balao balao-lumie">
      <AutorLumie />
      {m.explicacao ? (
        <>
          <p className="chat-explicacao-titulo">{m.exame}</p>
          <Explicacao explicacao={m.explicacao} />
        </>
      ) : (
        <p>{m.texto}</p>
      )}
      <NotaMensagemPadrao origem={m.origem} />
    </div>
  );
}
