import os
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()

class GeminiSummarizer:
	def __init__(self):
		api_key = os.getenv("GEMINI_API_KEY")
		if not api_key:
			raise ValueError("GEMINI_API_KEY environment variable not set.")
		self.llm = ChatGoogleGenerativeAI(google_api_key=api_key, model="gemini-2.5-flash", temperature=0.3)

	def summarize(self, feedback: str, max_words: int = 20) -> str:
		prompt = (
			f"Summarize the following customer feedback in {max_words} words or fewer, focusing on the main points and sentiment.\n\n"
			f"Feedback: {feedback}\n\nSummary:"
		)
		resp = self.llm.invoke(prompt)
		return getattr(resp, "content", str(resp)).strip()

if __name__ == "__main__":
	summarizer = GeminiSummarizer()
	long_feedback = (
		"I ordered this dress for a wedding and while the color was beautiful, the fit was not as expected. "
		"The bust was too tight and the zipper was difficult to use. However, the fabric felt nice and the length was perfect. "
		"I wish the sizing was more consistent."
	)
	summary = summarizer.summarize(long_feedback)
	print("Original Feedback:", long_feedback)
	print("Summary:", summary)
