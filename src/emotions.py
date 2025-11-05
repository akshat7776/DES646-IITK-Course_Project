import os
import sys
import json
from typing import List, Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
try:
	# For optimal one-to-one mapping between clusters and emotions
	from scipy.optimize import linear_sum_assignment  # type: ignore
	_HAS_SCIPY = True
except Exception:  # pragma: no cover
	_HAS_SCIPY = False

try:
	from sentence_transformers import SentenceTransformer
except Exception as e:  # pragma: no cover
	SentenceTransformer = None  # type: ignore


EMOTIONS: List[str] = [
	"joy", "sadness", "anger", "fear", "surprise", "neutral"
]

EMOTION_PROMPTS: Dict[str, str] = {
	"joy": "This text expresses joy, happiness, or delight.",
	"sadness": "This text expresses sadness, disappointment, or sorrow.",
	"anger": "This text expresses anger, frustration, or annoyance.",
	"fear": "This text expresses fear, anxiety, or worry.",
	"surprise": "This text expresses surprise or astonishment.",
	"neutral": "This text is neutral or matter-of-fact without strong emotion.",
}


def _load_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
	if SentenceTransformer is None:
		raise RuntimeError("Please install 'sentence-transformers' package")
	return SentenceTransformer(model_name)


def _embed(model, texts: List[str]) -> np.ndarray:
	return np.asarray(model.encode(texts, normalize_embeddings=True))


def _kmeans_cluster(embeddings: np.ndarray, k: int, random_state: int = 42) -> Tuple[np.ndarray, np.ndarray]:
	kmeans = KMeans(n_clusters=k, random_state=random_state, n_init=10)
	labels = kmeans.fit_predict(embeddings)
	centers = kmeans.cluster_centers_
	return labels, centers


def _label_clusters(centers: np.ndarray, emotion_embs: np.ndarray, emotion_names: List[str]) -> Dict[int, str]:
	"""Map each cluster center to an emotion.

	If SciPy is available and the number of clusters equals the number of emotions,
	use an optimal one-to-one assignment (Hungarian algorithm) to reduce duplicate
	mappings (e.g., everything going to 'joy' or 'neutral'). Otherwise, fall back to
	per-row argmax.
	"""
	k = centers.shape[0]
	m = emotion_embs.shape[0]
	sims = cosine_similarity(centers, emotion_embs)  # (k, m)
	cluster_to_emotion: Dict[int, str] = {}

	if _HAS_SCIPY and k == m:
		# Maximize total similarity -> minimize negative similarity
		row_ind, col_ind = linear_sum_assignment(-sims)
		for ci, ej in zip(row_ind, col_ind):
			cluster_to_emotion[int(ci)] = emotion_names[int(ej)]
		return cluster_to_emotion

	# Fallback: independent argmax per cluster
	for i in range(k):
		j = int(np.argmax(sims[i]))
		cluster_to_emotion[i] = emotion_names[j]
	return cluster_to_emotion


def cluster_emotions(
	texts: List[str],
	*,
	k: int | None = None,
	model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
) -> List[str]:
	"""Cluster texts and return an emotion label per text using centroid similarity.

	Steps:
	- Embed texts
	- KMeans cluster with k clusters
	- Embed emotion prompts, map centers to nearest emotion
	- Return mapped emotion for each text
	"""
	if not texts:
		return []

	model = _load_model(model_name)
	X = _embed(model, texts)
	# If k not provided, default to number of emotions (bounded by number of texts)
	k_target = len(EMOTIONS) if k is None else int(k)
	k_eff = max(1, min(k_target, len(texts)))
	labels, centers = _kmeans_cluster(X, k=k_eff)

	# Emotion reference embeddings
	emotion_prompts = [EMOTION_PROMPTS[e] for e in EMOTIONS]
	E = _embed(model, emotion_prompts)

	cluster_to_emotion = _label_clusters(centers, E, EMOTIONS)
	# Map each text's cluster to an emotion
	return [cluster_to_emotion[int(c)] for c in labels]


if __name__ == "__main__":
	feedback = [
		"I didn't like it at all, it was a terrible experience."
	]
	preds = cluster_emotions(feedback, k=7)
	for emo in preds:
		print(f"EMOTION: {emo}")

