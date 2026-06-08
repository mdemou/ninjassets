FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src \
    HF_HOME=/models/hf

WORKDIR /app

RUN pip install --no-cache-dir uv

# Install dependencies from the lock-free pyproject (src layout, hatchling).
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN uv pip install --system --no-cache .

# Bake the models so containers start offline (SPEC §14.4):
#  - multilingual-e5-base embeddings (~1.1 GB) into HF_HOME
#  - spaCy NER models for Presidio (EN + ES)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')" \
 && python -m spacy download en_core_web_sm \
 && python -m spacy download es_core_news_md

EXPOSE 8000

CMD ["uvicorn", "ai_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
