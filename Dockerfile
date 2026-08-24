# ==============================================================================
# Zenith Bank - Loan Eligibility Checking System (LES)
# Production Container Image
# ==============================================================================

FROM python:3.12-slim AS runtime

# Set environment flags
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    HOST=0.0.0.0

# Create non-root system user for security compliance
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Set working directory
WORKDIR /app

# Install optional Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy application assets
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

# Expose service port
EXPOSE 8080

# Healthcheck for container orchestrators (Cloud Run, ECS, Kubernetes, Docker Swarm)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request, os; port = os.environ.get('PORT', '8080'); urllib.request.urlopen(f'http://127.0.0.1:{port}/health')" || exit 1

# Start production server
CMD ["python", "server.py"]
