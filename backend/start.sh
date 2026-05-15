#!/bin/bash
set -e
echo "📖 Loading knowledge base into ChromaDB..."
python knowledge_base/load_data.py
echo "🚀 Starting CareerLens AI backend..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
