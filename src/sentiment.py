import pandas as pd
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Ensure VADER lexicon is downloaded
try:
	nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
	nltk.download('vader_lexicon')

def vader_sentiment_score(text: str) -> float:
	analyzer = SentimentIntensityAnalyzer()
	return analyzer.polarity_scores(text)['compound']

def vader_sentiment_label(compound: float) -> str:
	if compound >= 0.2:
		return 'positive'
	elif compound <= -0.2:
		return 'negative'
	else:
		return 'neutral'

def add_vader_sentiment(df: pd.DataFrame, text_col: str = 'Review Text', label_col: str = 'VADER_Sentiment') -> pd.DataFrame:
	
    # Adds VADER compound score and sentiment label columns to a DataFrame.
	df = df.copy()
	df['VADER_Compound'] = df[text_col].astype(str).apply(vader_sentiment_score)
	df[label_col] = df['VADER_Compound'].apply(vader_sentiment_label)
	return df

if __name__ == "__main__":
	import os
	import pandas as pd
	from sentiment import add_vader_sentiment
	csv_path = os.path.join(os.path.dirname(__file__), "..", r"D:\DES646_Project\outputs\clean_csv.csv")  # your csv path here 
	csv_path = os.path.abspath(csv_path)
	if not os.path.exists(csv_path):
		print(f"CSV not found: {csv_path}")
	else:
		df = pd.read_csv(csv_path)
		df = add_vader_sentiment(df)
		print(df[["Review Text", "VADER_Compound", "VADER_Sentiment"]].head())
		print(df['VADER_Sentiment'].value_counts())