# Imagem base: Node.js 24 (versão LTS = suporte longo) sobre Alpine Linux,
# uma distribuição mínima (~50 MB), o que deixa a imagem enxuta.
FROM node:24-alpine

# Avisa às bibliotecas que é ambiente de produção (menos logs de depuração).
ENV NODE_ENV=production
# Pasta onde ficam os dados de idioma do OCR (lida pelo código via process.env).
ENV TESSDATA_PATH=/app/tessdata

# Todos os comandos a seguir rodam dentro de /app no container.
WORKDIR /app

# --- Dados de idioma do OCR (Tesseract.js) ---
# Por padrão o Tesseract.js baixa o idioma da internet na PRIMEIRA leitura de foto.
# Baixamos aqui, no build, para que a imagem já saia com os arquivos e a demo
# não dependa da rede para isso. Mesma origem e versão que o Tesseract.js usa.
ADD https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz /app/tessdata/
ADD https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz /app/tessdata/
# O ADD de URL cria arquivos que só o root lê; liberamos a leitura para todos.
RUN chmod 644 /app/tessdata/*

# Pasta dos uploads temporários, de propriedade do usuário "node" (não-root).
# No compose ela é substituída por um tmpfs (memória RAM).
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# Copia SÓ os arquivos de dependências primeiro. Assim o Docker reaproveita
# (cache) a camada do "npm ci" enquanto as dependências não mudarem.
COPY package.json package-lock.json ./

# Instala exatamente o que está no package-lock.json (ci = reprodutível),
# sem as dependências de desenvolvimento (--omit=dev), e apaga o cache do npm.
RUN npm ci --omit=dev && npm cache clean --force

# Agora copia o código da aplicação.
COPY src ./src

# Troca para o usuário "node" (já existe na imagem oficial): se alguém explorar
# uma falha no app, não terá poderes de administrador dentro do container.
USER node

# Documenta a porta em que o app escuta (quem publica de fato é o compose).
EXPOSE 3001

# Comando que inicia o servidor quando o container sobe.
CMD ["node", "src/server.js"]
