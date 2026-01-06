# ============================================
# Shopee Video Downloader Bot - Dockerfile
# Node.js Version
# ============================================
FROM node:20-slim

# Define variáveis de ambiente
ENV NODE_ENV=production

# Cria diretório de trabalho
WORKDIR /app

# Copia package.json e instala dependências
COPY package.json .
RUN npm install --production

# Copia os arquivos do projeto
COPY shopeeService.js .
COPY shopeeServiceNew.js .
COPY database.js .
COPY paymentService.js .
COPY bot.js .

# Cria pasta de output para os vídeos temporários
RUN mkdir -p /app/output_video

# Variável de ambiente para o token (será passada via docker-compose)
ENV TELEGRAM_BOT_TOKEN=""

# Comando para iniciar o bot
CMD ["node", "bot.js"]
