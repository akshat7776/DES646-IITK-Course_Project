import os, sys, json
from dotenv import load_dotenv
load_dotenv()

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:  
    ChatGoogleGenerativeAI = None  

EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"]


def classify(text: str, model: str = "gemini-2.5-flash") -> dict:
    if ChatGoogleGenerativeAI is None:
        raise RuntimeError("Please install langchain-google-genai")
    key = os.getenv("GEMINI_API_KEY") 
    if not key:
        raise RuntimeError("Set GEMINI_API_KEY")

    llm = ChatGoogleGenerativeAI(model=model, temperature=0.1, max_output_tokens=256, google_api_key=key)
    prompt = (
        "Classify the product review into a single emotion from: "
        + ", ".join(EMOTIONS)
        + ". Return JSON: {\"emotion\": \"<label>\", \"scores\": {\"label\": prob}}\n"
        "Text:\n" + text
    )

    try:
        r = llm.invoke(prompt)
        s = getattr(r, "content", str(r)).strip()
        i, j = s.find("{"), s.rfind("}")
        if i != -1 and j != -1 and j > i:
            s = s[i : j + 1]
        data = json.loads(s)
        emo = str(data.get("emotion", "neutral")).lower()
        if emo not in EMOTIONS:
            emo = "neutral"
        scores = data.get("scores", {})
        if not isinstance(scores, dict):
            scores = {}
        return {"emotion": emo, "scores": scores}
    except Exception:
        return {"emotion": "neutral", "scores": {}}


if __name__ == "__main__":
    feedback = [
        # Add your feedback strings here:
        "hated the fabric ",
        # "The color was totally different than pictured",
    ]

    for txt in feedback:
        res = classify(txt)
        print(json.dumps({**res}, ensure_ascii=False))
