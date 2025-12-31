# ============================================
# Shopee Video Downloader Bot - Dockerfile
# ============================================
FROM python:3.12-slim

# Define variáveis de ambiente
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Cria diretório de trabalho
WORKDIR /app

# Copia requirements e instala dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia os arquivos do projeto
COPY shopee_service.py .
COPY database.py .
COPY payment_service.py .
COPY bot.py .

# Cria pasta de output para os vídeos temporários
RUN mkdir -p /app/output_video

# Variável de ambiente para o token (será passada no docker run)
ENV TELEGRAM_BOT_TOKEN=""

# Comando para iniciar o bot
CMD ["python", "bot.py"]
