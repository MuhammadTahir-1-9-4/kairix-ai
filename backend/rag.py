import os

from dotenv import load_dotenv

load_dotenv()

FALLBACK_CONTEXT = (
    "General career advice: Focus on showing measurable achievements, "
    "tailor your CV to each job, and highlight transferable skills."
)


def retrieve_career_context(query: str) -> str:
    try:
        from langchain_community.vectorstores import Chroma
        from langchain_community.embeddings import HuggingFaceEmbeddings

        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        persist_dir = os.path.normpath(os.path.join(backend_dir, persist_dir))

        if not os.path.exists(persist_dir):
            print(f"⚠️  ChromaDB directory not found at {persist_dir}. Using fallback context.")
            return FALLBACK_CONTEXT

        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

        vectorstore = Chroma(
            collection_name="career_knowledge",
            embedding_function=embeddings,
            persist_directory=persist_dir,
        )

        collection = vectorstore._collection
        if collection.count() == 0:
            print("⚠️  ChromaDB collection is empty. Using fallback context.")
            return FALLBACK_CONTEXT

        results = vectorstore.similarity_search_with_relevance_scores(query, k=6)

        if not results:
            return FALLBACK_CONTEXT

        filtered = [doc for doc, score in results if score >= 0.3]
        if not filtered:
            filtered = [doc for doc, _ in results[:3]]

        context = "\n\n".join(doc.page_content for doc in filtered)
        return context

    except Exception as exc:
        print(f"⚠️  RAG retrieval error: {exc}. Using fallback context.")
        return FALLBACK_CONTEXT
