# ===== Estágio 1: "build" — gera os arquivos estáticos do React =====
# Usa Node só para compilar; nada deste estágio vai para a imagem final,
# a não ser a pasta dist/ copiada no estágio 2.
FROM node:24-alpine AS build

# Pasta de trabalho dentro do container.
WORKDIR /app

# Copia só os arquivos de dependências primeiro, para o Docker reaproveitar
# o cache do "npm ci" enquanto as dependências não mudarem.
COPY package.json package-lock.json ./

# Instala TODAS as dependências (inclusive as de desenvolvimento, como o Vite),
# porque aqui elas são necessárias para compilar. Elas não vão para a imagem final.
RUN npm ci

# Copia o restante do código do front (index.html, src/, vite.config.js...).
COPY . .

# Compila o React: gera HTML, CSS e JS otimizados em /app/dist.
RUN npm run build

# ===== Estágio 2: "servir" — nginx entrega os arquivos e faz o proxy =====
# Imagem final: só o nginx (servidor web leve) + os estáticos. Sem Node, sem
# node_modules, sem código-fonte: imagem pequena e com menos coisa para atacar.
FROM nginx:stable-alpine

# Copia a configuração para a pasta de templates. Ao iniciar, a imagem do nginx
# substitui ${BACKEND_PORT} e grava o resultado em /etc/nginx/conf.d/default.conf.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copia do estágio 1 apenas o resultado do build.
COPY --from=build /app/dist /usr/share/nginx/html

# Documenta a porta do nginx dentro do container.
EXPOSE 80

# Não há CMD: a imagem oficial do nginx já sabe como iniciar.
