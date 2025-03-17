FROM python:3.9-slim

WORKDIR /app

# Instala dependências do Python
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copia a aplicação
COPY . .

EXPOSE 3000

CMD ["python", "app.py"]
