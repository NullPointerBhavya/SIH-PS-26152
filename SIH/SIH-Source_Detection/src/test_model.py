from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

print("Loading model...")

model = SentenceTransformer(MODEL_NAME)

print("Model loaded successfully!\n")


posts = [
    "Government policy has badly affected small businesses.",
    
    "Small traders are suffering because of the new government policy.",
    
    "The new policy is damaging local businesses and shopkeepers.",
    
    "Heavy rainfall is expected in Chennai tomorrow.",
    
    "India won the cricket match yesterday."
]


print("Generating embeddings...")

embeddings = model.encode(posts)

similarity_matrix = cosine_similarity(embeddings)


print("\n========== SIMILARITY RESULTS ==========\n")

for i in range(len(posts)):
    for j in range(i + 1, len(posts)):

        similarity = similarity_matrix[i][j]

        print(f"Post {i + 1} ↔ Post {j + 1}")
        print(f"Similarity: {similarity:.3f}")
        print()

print("========================================")