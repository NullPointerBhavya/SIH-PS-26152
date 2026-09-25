from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering

# Load our pretrained multilingual model
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

print("Loading model...")
model = SentenceTransformer(MODEL_NAME)
print("Model loaded!\n")


# Sample social-media posts
posts = [
    # Narrative 1
    "Government policy has badly affected small businesses.",
    "Small traders are suffering because of the new government policy.",
    "The new policy is damaging local businesses and shopkeepers.",
    "Local businesses are struggling because of this government decision.",

    # Narrative 2
    "Heavy rainfall is expected in Chennai tomorrow.",
    "Chennai residents have been warned about heavy rain.",
    "IMD has issued a rainfall warning for Chennai.",
    "People in Chennai should prepare for heavy rainfall.",

    # Narrative 3
    "India won the cricket match yesterday.",
    "India defeated its opponent in yesterday's cricket game.",
    "India secured a victory in the cricket match.",
    "The Indian team won yesterday's match."
]


print("Generating embeddings...")
embeddings = model.encode(posts)

print("Embeddings generated!\n")


# Create clusters
clustering = AgglomerativeClustering(
    n_clusters=3,
    metric="cosine",
    linkage="average"
)

labels = clustering.fit_predict(embeddings)


# Display results
print("========== NARRATIVE CLUSTERS ==========\n")

clusters = {}

for i, label in enumerate(labels):
    if label not in clusters:
        clusters[label] = []

    clusters[label].append(posts[i])


for cluster_id, cluster_posts in clusters.items():

    print(f"\n--- Narrative Cluster {cluster_id} ---")

    for post in cluster_posts:
        print("•", post)

print("\n========================================")