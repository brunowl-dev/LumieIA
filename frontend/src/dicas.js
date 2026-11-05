// Dicas do banner "Dica da Lumie", por tela. São textos que o paciente lê, então
// seguem as mesmas regras da base de conhecimento: nada de diagnóstico, remédio
// ou veredito. Cada dica repete algo que o sistema JÁ faz ou já diz em outro
// lugar (contrato, base, mensagens do back), para não prometer o que não existe.
export const DICAS = {
  catalogo: [
    { titulo: 'Laudos fictícios', texto: 'Todos os laudos desta demonstração são fictícios. Nenhum dado é de uma pessoa real.' },
    { titulo: 'A faixa é a do seu laudo', texto: 'Cada laboratório define a sua faixa de referência. A Lumie sempre usa a faixa impressa no laudo.' },
    { titulo: 'Seus dados protegidos', texto: 'A inteligência artificial recebe só os valores do exame, nunca o seu nome ou os seus documentos.' },
    { titulo: 'Vai enviar uma foto?', texto: 'Boa luz, sem sombras e com a folha inteira aparecendo ajudam a ler o laudo.' },
  ],
  exames: [
    { titulo: 'Como ler as cores', texto: 'Verde: dentro da faixa do laudo. Amarelo: fora da faixa. Vermelho: valor muito distante da faixa, com alerta de atendimento prioritário.' },
    { titulo: 'Quem decide a cor', texto: 'A cor e o alerta vêm de regras fixas do sistema, não da inteligência artificial.' },
    { titulo: 'Entenda cada exame', texto: 'Toque em "Explicar com IA" para ver, em linguagem simples, o que o exame avalia e o que o seu resultado significa.' },
    { titulo: 'Na consulta', texto: 'Leve o laudo original: é com ele que o profissional de saúde avalia o resultado.' },
  ],
  chat: [
    { titulo: 'O que perguntar', texto: 'Pergunte sobre este exame: o que ele mede, o que pode influenciar o valor, por que pedem jejum.' },
    { titulo: 'O que a Lumie não faz', texto: 'A Lumie não diagnostica e não indica remédios. Para isso, procure um profissional de saúde.' },
    { titulo: 'Respostas verificadas', texto: 'Cada resposta passa por uma verificação de segurança antes de aparecer na tela.' },
  ],
};
