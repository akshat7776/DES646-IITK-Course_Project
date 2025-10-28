import os
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()

class ReplyGenerator:
	def __init__(self):
		api_key = os.getenv("GEMINI_API_KEY")
		if not api_key:
			raise ValueError("GEMINI_API_KEY environment variable not set.")
		self.llm = ChatGoogleGenerativeAI(google_api_key=api_key, model="gemini-2.5-flash", temperature=0.4)

	def generate_reply(self, feedback: str) -> str:
		prompt = (
			"You are a helpful customer support assistant. Read the following customer feedback and write a polite, empathetic, and actionable reply. "
			"If the feedback is positive, thank the customer. If it is negative, apologize and offer help.\n\n"
			f"Customer feedback: {feedback}\n\nReply:"
		)
		resp = self.llm.invoke(prompt)
		return getattr(resp, "content", str(resp)).strip()

if __name__ == "__main__":
	rg = ReplyGenerator()
	sample_feedback = "The dress was beautiful but the zipper was broken and I had to return it."
	reply = rg.generate_reply(sample_feedback)
	print("Feedback:", sample_feedback)
	print("Reply:", reply)