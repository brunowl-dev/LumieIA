// Pré-visualização do laudo ANTES da leitura: o paciente confere que escolheu o
// arquivo certo e vê como ele é (layout, páginas, onde estão os resultados).
//
// PDF: usa o leitor de PDF do próprio navegador, dentro de um <iframe> (sem
// biblioteca nova). Foto: <img>. Nos dois casos o arquivo NÃO é enviado ao
// servidor aqui: no envio manual, `url` é um endereço local (blob:) criado no
// navegador; no catálogo, é o arquivo de demonstração em /laudos/.
//
// Alguns navegadores de celular não mostram PDF dentro da página: o link
// "Abrir em tamanho real" funciona em todos.
import Icone from './Icone.jsx';

export default function PreviaArquivo({ url, tipo, nome }) {
  const titulo = `Pré-visualização de ${nome}`;
  return (
    <figure className="previa">
      <figcaption>
        <span>
          <Icone nome={tipo === 'foto' ? 'camera' : 'documento'} />
          <strong>{nome}</strong>
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Abrir em tamanho real ↗
        </a>
      </figcaption>
      <div className="previa-quadro">
        {tipo === 'foto' ? (
          <img src={url} alt={titulo} />
        ) : (
          // view=FitH: a página ocupa a largura do quadro (ignorado por quem não entende).
          <iframe src={`${url}#view=FitH`} title={titulo} />
        )}
      </div>
    </figure>
  );
}
