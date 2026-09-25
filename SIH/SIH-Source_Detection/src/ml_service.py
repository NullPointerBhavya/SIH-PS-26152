from flask import Flask, request, jsonify
from flask_cors import CORS

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx


app = Flask(__name__)
CORS(app)


# -----------------------------------
# Load pretrained model ONCE
# -----------------------------------

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

print("Loading pretrained model...")
model = SentenceTransformer(MODEL_NAME)
print("Model loaded successfully!")


# -----------------------------------
# Source detection function
# -----------------------------------

def detect_source(posts):

    if not posts:
        return {
            "success": False,
            "message": "No posts received"
        }

    # --------------------------------
    # Generate embeddings
    # --------------------------------

    texts = [post["text"] for post in posts]

    embeddings = model.encode(texts)

    similarity_matrix = cosine_similarity(embeddings)


    # --------------------------------
    # Create graph
    # --------------------------------

    graph = nx.DiGraph()


    # Add posts as nodes
    for post in posts:

        graph.add_node(
            post["post_id"],
            user_id=post.get("user_id"),
            text=post["text"],
            timestamp=post["timestamp"]
        )


    # --------------------------------
    # Create temporal + semantic edges
    # --------------------------------

    SIMILARITY_THRESHOLD = 0.70

    for i in range(len(posts)):

        for j in range(len(posts)):

            if i == j:
                continue

            source = posts[i]
            target = posts[j]

            # Earlier → later
            if source["timestamp"] >= target["timestamp"]:
                continue

            similarity = similarity_matrix[i][j]

            if similarity >= SIMILARITY_THRESHOLD:

                graph.add_edge(
                    source["post_id"],
                    target["post_id"],
                    similarity=float(similarity)
                )


    # --------------------------------
    # Source scoring
    # --------------------------------

    source_scores = {}

    for node in graph.nodes():

        outgoing = graph.out_degree(node)
        incoming = graph.in_degree(node)

        score = outgoing - incoming

        source_scores[node] = score


    # --------------------------------
    # Rank candidates
    # --------------------------------

    ranked_sources = sorted(
        source_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )


    if not ranked_sources:
        return {
            "success": False,
            "message": "No propagation relationships found"
        }


    best_source = ranked_sources[0][0]


    # --------------------------------
    # Prepare result
    # --------------------------------

    source_post = next(
        post for post in posts
        if post["post_id"] == best_source
    )


    edges = []

    for source, target, data in graph.edges(data=True):

        edges.append({
            "source": source,
            "target": target,
            "similarity": round(
                data["similarity"], 3
            )
        })


    candidates = []

    for node, score in ranked_sources:

        candidates.append({
            "post_id": node,
            "user_id": graph.nodes[node]["user_id"],
            "timestamp": graph.nodes[node]["timestamp"],
            "score": score
        })


    return {
        "success": True,

        "source": {
            "post_id": source_post["post_id"],
            "user_id": source_post.get("user_id"),
            "timestamp": source_post["timestamp"],
            "text": source_post["text"]
        },

        "graph": edges,

        "candidates": candidates
    }


# -----------------------------------
# API endpoint
# -----------------------------------

@app.route("/detect-source", methods=["POST"])
def detect_source_api():

    try:

        data = request.get_json()

        posts = data.get("posts", [])

        result = detect_source(posts)

        return jsonify(result)


    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# -----------------------------------
# Start server
# -----------------------------------

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=8000,
        debug=True
    )