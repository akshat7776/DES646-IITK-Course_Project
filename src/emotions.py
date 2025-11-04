import os
import sys
import json
from typing import List, Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity

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
	# centers: (k, d), emotion_embs: (7, d)
	sims = cosine_similarity(centers, emotion_embs)  # (k, 7)
	cluster_to_emotion: Dict[int, str] = {}
	for i in range(centers.shape[0]):
		j = int(np.argmax(sims[i]))
		cluster_to_emotion[i] = emotion_names[j]
	return cluster_to_emotion


def cluster_emotions(
	texts: List[str],
	*,
	k: int = 7,
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
	# If number of texts < k, reduce k
	k_eff = max(1, min(k, len(texts)))
	labels, centers = _kmeans_cluster(X, k=k_eff)

	# Emotion reference embeddings
	emotion_prompts = [EMOTION_PROMPTS[e] for e in EMOTIONS]
	E = _embed(model, emotion_prompts)

	cluster_to_emotion = _label_clusters(centers, E, EMOTIONS)
	# Map each text's cluster to an emotion
	return [cluster_to_emotion[int(c)] for c in labels]


if __name__ == "__main__":
	feedback = [
		"This shirt is very flattering to all due to the adjustable front tie. it is the perfect length to wear with leggings and it is sleeveless so it pairs well with any cardigan. love this shirt!!!"
	]
	preds = cluster_emotions(feedback, k=7)
	for emo in preds:
		print(f"EMOTION: {emo}")

