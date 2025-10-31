from __future__ import annotations

from typing import Dict, List, Tuple
import json
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover
    SentenceTransformer = None  # type: ignore

from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity

# Default intent set
INTENTS: List[str] = [
    "complaint",
    "praise",
    "feature_request",
    "size_issue",
    "quality_concern",
    "shipping_issue",
    "return_request",
    "pricing_issue",
    "other",
]

# Short intent descriptions to embed for labeling
INTENT_PROMPTS: Dict[str, str] = {
    "complaint": "The customer is complaining about a problem or issue.",
    "praise": "The customer is praising or expressing satisfaction.",
    "feature_request": "The customer is requesting a new feature or improvement.",
    "size_issue": "The customer mentions sizing or fit problems.",
    "quality_concern": "The customer is concerned about product quality or defects.",
    "shipping_issue": "The customer reports shipping, delivery, or delay issues.",
    "return_request": "The customer is asking for a return, refund, or exchange.",
    "pricing_issue": "The customer raises concerns about price or value.",
    "other": "The feedback does not fit the above categories (other).",
}


def _load_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
    if SentenceTransformer is None:
        raise RuntimeError("Please install 'sentence-transformers' package")
    return SentenceTransformer(model_name)


def _embed(model, texts: List[str]) -> np.ndarray:
    return np.asarray(model.encode(texts, normalize_embeddings=True))


def _kmeans_cluster(X: np.ndarray, k: int, random_state: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    kmeans = KMeans(n_clusters=k, random_state=random_state, n_init=10)
    labels = kmeans.fit_predict(X)
    centers = kmeans.cluster_centers_
    return labels, centers


def _label_clusters(centers: np.ndarray, intent_embs: np.ndarray, intents: List[str]) -> Dict[int, str]:
    # centers: (k, d), intent_embs: (m, d)
    sims = cosine_similarity(centers, intent_embs)  # (k, m)
    mapping: Dict[int, str] = {}
    for i in range(centers.shape[0]):
        j = int(np.argmax(sims[i]))
        mapping[i] = intents[j]
    return mapping


def cluster_intents(
    texts: List[str],
    *,
    intents: List[str] | None = None,
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
    k: int | None = None,
) -> List[str]:
    """Cluster texts and map clusters to intents using prompt similarities.

    - If k is None, k = min(len(intents), len(texts))
    - Returns an intent label for each input text (order preserved)
    """
    if not texts:
        return []

    intents = intents or INTENTS
    model = _load_model(model_name)

    X = _embed(model, texts)
    k_eff = min(len(intents), len(texts)) if k is None else max(1, min(k, len(texts)))
    labels, centers = _kmeans_cluster(X, k=k_eff)

    # Build intent reference embedding matrix
    prompt_texts = [INTENT_PROMPTS.get(name, name) for name in intents]
    R = _embed(model, prompt_texts)

    c2i = _label_clusters(centers, R, intents)
    return [c2i[int(c)] for c in labels]


if __name__ == "__main__":
    # Minimal demo: add your feedback strings here
    feedback = [
        "This shirt is very flattering to all due to the adjustable front tie. it is the perfect length to wear with leggings and it is sleeveless so it pairs well with any cardigan. love this shirt!!!"
    ]

    preds = cluster_intents(feedback)
    for p in preds:
        print(p)
