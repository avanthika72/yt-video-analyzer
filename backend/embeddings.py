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


def store_embeddings(video_id: str, transcript: str) -> None:
    """Chunk transcript, generate embeddings, and store in ChromaDB."""
    chunks = chunk_transcript(transcript)
    embeddings = model.encode(chunks).tolist()

    # Use video_id as the collection name
    # Delete existing collection if re-processing the same video
    try:
        chroma_client.delete_collection(name=video_id)
    except Exception:
        pass

    collection = chroma_client.create_collection(name=video_id)
    collection.add(
        documents=chunks,
        embeddings=embeddings,
        ids=[f"{video_id}_chunk_{i}" for i in range(len(chunks))],
    )


def retrieve_relevant_chunks(video_id: str, question: str, top_k: int = 5) -> list[str]:
    """Embed the question and retrieve the most relevant transcript chunks."""
    collection = chroma_client.get_collection(name=video_id)
    question_embedding = model.encode([question]).tolist()
    results = collection.query(
        query_embeddings=question_embedding,
        n_results=top_k,
    )
    return results["documents"][0]  # list of top_k chunk strings