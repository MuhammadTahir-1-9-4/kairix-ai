import os
import sys

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings


def load_knowledge_base():
    import shutil

    persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    persist_dir = os.path.join(os.path.dirname(__file__), "..", persist_dir)
    persist_dir = os.path.normpath(persist_dir)

    data_file = os.path.join(os.path.dirname(__file__), "jobs_data.txt")

    # Wipe existing DB so we get a clean reload
    if os.path.exists(persist_dir):
        shutil.rmtree(persist_dir)
        print(f"🗑️  Cleared old ChromaDB at: {persist_dir}")

    print("📖 Loading knowledge base v2.0...")

    with open(data_file, "r", encoding="utf-8") as f:
        raw_text = f.read()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=80,
        length_function=len,
    )
    chunks = splitter.split_text(raw_text)

    print(f"✂️  Split into {len(chunks)} chunks. Embedding now (this takes ~60s)...")

    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        collection_name="career_knowledge",
        persist_directory=persist_dir,
    )

    print(f"✅ Done! {len(chunks)} chunks stored in ChromaDB at: {persist_dir}")


if __name__ == "__main__":
    load_knowledge_base()
