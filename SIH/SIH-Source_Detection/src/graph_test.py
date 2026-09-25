from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

print("Loading model...")
model = SentenceTransformer(MODEL_NAME)
print("Model loaded!\n")


# -----------------------------------
# 1. Sample social-media posts
# -----------------------------------

posts = [
    {
        "post_id": "P1",
        "user_id": "U1",
        "text": "The new government policy is badly affecting small businesses.",
        "timestamp": "2026-09-25 10:00:00"
    },

    {
        "post_id": "P2",
        "user_id": "U2",
        "text": "Small traders are suffering because of the new government policy.",
        "timestamp": "2026-09-25 10:15:00"
    },

    {
        "post_id": "P3",
        "user_id": "U3",
        "text": "The policy is damaging local businesses and shopkeepers.",
        "timestamp": "2026-09-25 10:30:00"
    },

    {
        "post_id": "P4",
        "user_id": "U4",
        "text": "Local businesses are struggling because of this government decision.",
        "timestamp": "2026-09-25 10:45:00"
    },

    {
        "post_id": "P5",
        "user_id": "U5",
        "text": "Heavy rainfall is expected in Chennai tomorrow.",
        "timestamp": "2026-09-25 11:00:00"
    }
]


# -----------------------------------
# 2. Generate embeddings
# -----------------------------------

texts = [post["text"] for post in posts]

print("Generating embeddings...")
embeddings = model.encode(texts)

similarity_matrix = cosine_similarity(embeddings)

print("Embeddings generated!\n")


# -----------------------------------
# 3. Create directed diffusion graph
# -----------------------------------

graph = nx.DiGraph()


# Add every post as a node
for post in posts:

    graph.add_node(
        post["post_id"],
        user_id=post["user_id"],
        text=post["text"],
        timestamp=post["timestamp"]
    )


# -----------------------------------
# 4. Create temporal + semantic edges
# -----------------------------------

SIMILARITY_THRESHOLD = 0.70

for i in range(len(posts)):

    for j in range(len(posts)):

        if i == j:
            continue

        # Earlier post → later post
        if posts[i]["timestamp"] < posts[j]["timestamp"]:

            similarity = similarity_matrix[i][j]

            # Only connect semantically similar posts
            if similarity >= SIMILARITY_THRESHOLD:

                graph.add_edge(
                    posts[i]["post_id"],
                    posts[j]["post_id"],
                    similarity=float(similarity)
                )


# -----------------------------------
# 5. Display graph
# -----------------------------------

print("========== DIFFUSION GRAPH ==========\n")

for source, target, data in graph.edges(data=True):

    print(
        f"{source} → {target}   "
        f"similarity = {data['similarity']:.3f}"
    )

print("\n====================================")

# -----------------------------------
# 6. Source inference
# -----------------------------------

print("\n========== SOURCE INFERENCE ==========\n")

source_scores = {}

for node in graph.nodes():

    # How many later posts can this node potentially lead to?
    outgoing_connections = graph.out_degree(node)

    # How many earlier posts point toward this node?
    incoming_connections = graph.in_degree(node)

    # Simple source score
    score = outgoing_connections - incoming_connections

    source_scores[node] = score


# Sort candidates by source score
ranked_sources = sorted(
    source_scores.items(),
    key=lambda x: x[1],
    reverse=True
)


print("Candidate sources:\n")

for node, score in ranked_sources:

    user_id = graph.nodes[node]["user_id"]
    timestamp = graph.nodes[node]["timestamp"]

    print(
        f"{node} | "
        f"User: {user_id} | "
        f"Time: {timestamp} | "
        f"Score: {score}"
    )


# -----------------------------------
# 7. Select top source
# -----------------------------------

best_source = ranked_sources[0][0]

print("\n------------------------------------")

print("EARLIEST OBSERVED SOURCE")

print(f"Post ID : {best_source}")
print(f"User ID : {graph.nodes[best_source]['user_id']}")
print(f"Time    : {graph.nodes[best_source]['timestamp']}")

print("------------------------------------")