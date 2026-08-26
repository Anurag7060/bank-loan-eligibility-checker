FROM python:3.12-slim

WORKDIR /app
COPY server.py index.html ./
COPY src ./src

RUN useradd --create-home --uid 10001 portaluser && chown -R portaluser:portaluser /app
USER portaluser

ENV HOST=0.0.0.0 \
    PORT=8080 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8080
CMD ["python", "server.py"]
