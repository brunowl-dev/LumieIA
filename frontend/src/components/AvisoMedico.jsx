// Aviso obrigatório (RNF-A3): sempre visível na tela de exames e no chat.
// Texto de referência do contrato §9; caixa no estilo dos avisos do app Lumie.
export default function AvisoMedico() {
  return (
    <p className="aviso-medico">
      <strong>Importante:</strong> estas informações são informativas e não substituem a avaliação de um
      profissional de saúde.
    </p>
  );
}
