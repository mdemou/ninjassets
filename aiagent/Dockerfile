FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src \
    HF_HOME=/models/hf

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml README.md ./
COPY src/ ./src/

# Resolve torch from the CPU wheel index. A plain `pip install .` pulls CUDA torch
# plus ~3 GB of nvidia-* / triton packages; reinstalling torch alone does not remove them.
RUN uv pip install --system --no-cache \
      --index-strategy unsafe-best-match \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      . \
 && (pip list --format=freeze \
      | grep -E '^(nvidia-|triton)=' \
      | cut -d= -f1 \
      | xargs -r uv pip uninstall --system || true)

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
