# Use uma imagem base com Python
FROM python:3.12-slim

# Defina o diretório de trabalho dentro do container
WORKDIR /app

# Instale o pacote postgresql-client
RUN apt-get update && apt-get install -y postgresql-client

# Copie o arquivo de requisitos e instale as dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie o restante do código do aplicativo
COPY . .

# Copie o script de inicialização (se necessário)
COPY wait-for-postgres.sh /wait-for-postgres.sh
RUN chmod +x /wait-for-postgres.sh

# Exponha a porta que o aplicativo usa
EXPOSE 3000

# Comando para rodar o aplicativo (corrigido)
CMD ["/bin/bash", "-c", "/wait-for-postgres.sh db && python app.py"]