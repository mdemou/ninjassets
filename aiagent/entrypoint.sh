#!/bin/sh
set -e

echo "Ensuring embedding model is cached in ${HF_HOME}..."
python - <<'PY'
import os

from sentence_transformers import SentenceTransformer

model = os.environ.get("EMBEDDING_MODEL_HF", "intfloat/multilingual-e5-base")
print(f"Loading embedding model {model!r}...")
SentenceTransformer(model)
print("Embedding model ready.")
PY

if [ "${PII_ENABLED:-true}" = "true" ]; then
  python -m spacy download "${PRESIDIO_SPACY_MODEL_EN:-en_core_web_sm}"
  python -m spacy download "${PRESIDIO_SPACY_MODEL_ES:-es_core_news_md}"
fi

exec uvicorn ai_service.main:app --host 0.0.0.0 --port 8000
