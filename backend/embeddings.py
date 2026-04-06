import os
import certifi
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

import chromadb
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Load model once at module level (avoids reloading on every request)
model = SentenceTransformer("all-MiniLM-L6-v2")

# Persistent ChromaDB client
chroma_client = chromadb.PersistentClient(path="./chroma_store")

def chunk_transcript(transcript: str) -> list[str]:
    """Split transcript into overlapping chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=300,
        chunk_overlap=50,
        length_function=len,
    )
    return splitter.split_text(transcript)


def safe_collection_name(video_id: str) -> str:
    """Ensure collection name is valid for ChromaDB (must start/end with alphanumeric)."""
    name = f"v{video_id}"  # prefix with 'v' to guarantee valid start
    return name


def store_embeddings(video_id: str, transcript: str) -> None:
    chunks = chunk_transcript(transcript)
    embeddings = model.encode(chunks).tolist()
    name = safe_collection_name(video_id)
    try:
        chroma_client.delete_collection(name=name)
    except Exception:
        pass
    collection = chroma_client.create_collection(name=name)
    collection.add(
        documents=chunks,
        embeddings=embeddings,
        ids=[f"{video_id}_chunk_{i}" for i in range(len(chunks))],
    )

def retrieve_relevant_chunks(video_id: str, question: str, top_k: int = 5) -> list[str]:
    collection = chroma_client.get_collection(name=safe_collection_name(video_id))
    question_embedding = model.encode([question]).tolist()
    results = collection.query(
        query_embeddings=question_embedding,
        n_results=top_k,
    )
    return results["documents"][0]