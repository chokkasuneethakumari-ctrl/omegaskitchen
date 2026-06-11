# Production container for the Omega's Kitchen FastAPI backend.
# Works on Render, Railway, Fly.io, Cloud Run, or any Docker host.
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; wheels cover the Python packages.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hosts inject $PORT; default to 8001 for local `docker run`.
ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
