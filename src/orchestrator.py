from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional
try:
	from dotenv import load_dotenv  # type: ignore
	load_dotenv()
except Exception:
	pass

import numpy as np
import pandas as pd

# Local modules (work both as package and as standalone script directory)
try:
	# When executed as a package (e.g., python -m src.orchestrator)
	from . import sentiment as sentiment_mod  # type: ignore
	from . import emotions as emotions_mod  # type: ignore
	from . import intent as intents_mod  # type: ignore
except Exception:
	# When imported from a sibling (e.g., serve_rag.py in same folder)
	import sys as _sys, os as _os
	_sys.path.append(_os.path.dirname(__file__))
	import sentiment as sentiment_mod  # type: ignore
	import emotions as emotions_mod  # type: ignore
	import intent as intents_mod  # type: ignore


def _get_api_key() -> Optional[str]:
	return os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")


def _load_gemini_model(model_name: str = "gemini-2.5-flash"):
	try:
		import google.generativeai as genai  # type: ignore
	except Exception as e:  # pragma: no cover
		raise RuntimeError(
			"google-generativeai is not installed. Install with: pip install google-generativeai"
		) from e

	api_key = _get_api_key()
	if not api_key:
		raise RuntimeError(
			"Missing API key. Set GOOGLE_API_KEY or GEMINI_API_KEY in your environment."
		)

	genai.configure(api_key=api_key)  # type: ignore[attr-defined]
	return genai.GenerativeModel(model_name)  # type: ignore[attr-defined]


# Data structures 
@dataclass
class OrchestratedSignals:
	sentiment_score: float
	sentiment_label: str
	emotion: str
	intent: str


@dataclass
class GeminiPrediction:
	repeat_purchase: bool
	nps_score: int
	reason: str


@dataclass
class OrchestratedResult:
	text: str
	signals: OrchestratedSignals
	prediction: GeminiPrediction


# Core orchestration 
def analyze_text_with_locals(text: str) -> OrchestratedSignals:
	"""Compute sentiment, emotion, and intent using local modules.

	- sentiment: VADER compound and label
	- emotion: emotions.cluster_emotions on single-item list
	- intent: intent_cluster.cluster_intents on single-item list
	"""
	text_s = str(text)

	# Sentiment
	s_score = float(sentiment_mod.vader_sentiment_score(text_s))
	s_label = sentiment_mod.vader_sentiment_label(s_score)

	# Emotion
	try:
		emo = emotions_mod.cluster_emotions([text_s])[0]
	except Exception:
		# Fallback neutral if emotion model not available
		emo = "neutral"

	# Intent
	try:
		intent = intents_mod.cluster_intents([text_s])[0]
	except Exception:
		intent = "other"

	return OrchestratedSignals(
		sentiment_score=s_score,
		sentiment_label=s_label,
		emotion=emo,
		intent=intent,
	)


def _build_gemini_prompt(text: str, signals: OrchestratedSignals) -> str:
	"""Craft a concise instruction for Gemini; ask for strict JSON output.

	Target JSON schema:
	{
	  "repeat_purchase": true|false,
	  "nps_score": 0-10 integer,
	  "reason": "short explanation"
	}
	"""
	return (
		"You are a customer feedback analyst.\n"
		"Given the raw feedback text and pre-computed signals, predict whether the"
		" customer is likely to make a repeat purchase and estimate an NPS score"
		" (0-10). Keep answers consistent with the signals but use your judgment."\
		"\n\n"
		f"Feedback: {text}\n"
		f"Signals: sentiment_label={signals.sentiment_label}, sentiment_score={signals.sentiment_score:.3f}, "
		f"emotion={signals.emotion}, intent={signals.intent}\n\n"
		"Return ONLY a compact JSON object with keys repeat_purchase (boolean), "
		"nps_score (integer 0-10), reason (short string)."
	)


def gemini_predict(text: str, signals: OrchestratedSignals) -> GeminiPrediction:
	model = _load_gemini_model()

	generation_config: Dict[str, Any] = {
		"temperature": 0.2,
		"max_output_tokens": 256,
		# Ask the model to respond with JSON to simplify parsing
		"response_mime_type": "application/json",
	}

	prompt = _build_gemini_prompt(text, signals)

	# The Python SDK accepts plain strings as content
	resp = model.generate_content(prompt, generation_config=generation_config)  # type: ignore[arg-type]

	def _response_text(r) -> str:
		# Try the convenience accessor first
		try:
			t = r.text  # may raise if no valid Part
			if t:
				return str(t)
		except Exception:
			pass
		# Fallback: scan candidates/parts
		try:
			for c in getattr(r, "candidates", []) or []:
				content = getattr(c, "content", None)
				if not content:
					continue
				for p in getattr(content, "parts", []) or []:
					t = getattr(p, "text", None)
					if t:
						return str(t)
		except Exception:
			pass
		return ""

	raw = _response_text(resp).strip()

	# Defensive parsing: handle code fences or extra text
	def _extract_json(s: str) -> Dict:
		s = s.strip()
		# Remove common Markdown code fences
		if s.startswith("```") and s.endswith("```"):
			s = s.strip("`")
			if s.startswith("json\n"):
				s = s[5:]
		# Find first and last braces as a fallback
		l = s.find("{")
		r = s.rfind("}")
		if l != -1 and r != -1 and r > l:
			s = s[l : r + 1]
		return json.loads(s)

	try:
		data = _extract_json(raw) if raw else {}
	except Exception:
		# Fallback conservative defaults
		data = {}

	if not data:
		# No usable JSON from model; provide safe defaults with context
		finish_reason = None
		try:
			finish_reason = getattr(getattr(resp, "candidates", [None])[0], "finish_reason", None)
		except Exception:
			pass
		data = {
			"repeat_purchase": signals.sentiment_label == "positive",
			"nps_score": int(np.clip(round((signals.sentiment_score + 1) * 5), 0, 10)),
			"reason": f"Fallback (no model JSON). finish_reason={finish_reason}",
		}

	repeat_purchase = bool(data.get("repeat_purchase", False))
	try:
		nps_score = int(data.get("nps_score", 0))
	except Exception:
		nps_score = 0
	nps_score = int(np.clip(nps_score, 0, 10))
	reason = str(data.get("reason", ""))[:500]

	return GeminiPrediction(repeat_purchase=repeat_purchase, nps_score=nps_score, reason=reason)


def analyze_text(text: str) -> OrchestratedResult:
	signals = analyze_text_with_locals(text)
	try:
		prediction = gemini_predict(text, signals)
	except Exception as e:
		prediction = GeminiPrediction(
			repeat_purchase=signals.sentiment_label == "positive",
			nps_score=int(np.clip(round((signals.sentiment_score + 1) * 5), 0, 10)),
			reason=f"Fallback (Gemini error): {e}",
		)
	return OrchestratedResult(text=text, signals=signals, prediction=prediction)



# --- CLI ---------------------------------------------------------------------
def _build_arg_parser() -> argparse.ArgumentParser:
	p = argparse.ArgumentParser(description="Gemini-backed feedback orchestrator (single text)")
	p.add_argument("--text", required=True, help="Feedback text to analyze")
	return p


def _print_result(result: OrchestratedResult) -> None:
	data = {
		"text": result.text,
		"signals": asdict(result.signals),
		"prediction": asdict(result.prediction),
	}
	print(json.dumps(data, ensure_ascii=False, indent=2))


def main(argv: Optional[list[str]] = None) -> int:
	parser = _build_arg_parser()
	args = parser.parse_args(argv)

	res = analyze_text(args.text)
	_print_result(res)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

