FROM python:3.10-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# Copiar e instalar los requerimientos de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto
COPY . .

# Exponer el puerto del backend
EXPOSE 8003

# Comando para arrancar el servidor FastAPI
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8003"]