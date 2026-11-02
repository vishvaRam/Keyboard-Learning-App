FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# dependencies first so the layer is reused when only app code changes
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# the app's defaults bind 127.0.0.1, which is unreachable from outside the container
ENV HOST=0.0.0.0 \
    PORT=4567 \
    DEBUG=false

EXPOSE 4567

# the app has no writable state, so an unprivileged user is enough
RUN useradd --create-home --uid 1000 appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ['PORT'] + '/api/config', timeout=2)"

CMD ["python", "-m", "app.main"]
