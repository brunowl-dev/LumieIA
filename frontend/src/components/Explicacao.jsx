// A explicação em 5 partes, sempre na ordem do artigo (contrato §5.2).
// Usada no chat do exame e na tela "Todas as explicações".

// Títulos das partes 1 a 4; a parte 5 (aviso) fecha a mensagem sem título.
const PARTES = [
  ['o_que_avalia', 'O que o exame avalia'],
  ['valor_e_posicao', 'Seu resultado'],
  ['significado', 'O que isso significa'],
  ['especialidade', 'Especialidade indicada'],
];

// Parte vazia (null) não aparece. As partes entram uma depois da outra, na ordem
// do artigo (--ordem → atraso da animação em .parte no styles.css). É só efeito
// visual: o texto inteiro já chegou do back e já passou pela segurança.
export function Explicacao({ explicacao }) {
  return (
    <>
      {PARTES.map(
        ([campo, titulo], indice) =>
          explicacao[campo] && (
            <div key={campo} className="parte" style={{ '--ordem': indice }}>
              <strong>{titulo}</strong>
              <p>{explicacao[campo]}</p>
            </div>
          ),
      )}
      <p className="parte-aviso" style={{ '--ordem': PARTES.length }}>
        {explicacao.aviso}
      </p>
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

// Cabeçalho dos balões da Lumie: o mascote (a gotinha) como avatar + o nome.
export function AutorLumie() {
  return (
    <span className="balao-autor">
      <img className="avatar-lumie" src="/mascote.png" alt="" aria-hidden="true" /> Lumie
    </span>
  );
}

// Balão da Lumie com a explicação (1ª mensagem do chat).
export function BalaoExplicacao({ explicacao, origem }) {
  return (
    <div className="balao balao-lumie">
      <AutorLumie />
      <Explicacao explicacao={explicacao} />
      <NotaMensagemPadrao origem={origem} />
    </div>
  );
}
