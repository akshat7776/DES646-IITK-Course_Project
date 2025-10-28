import pandas as pd
import re

def clean_text(text):
	"""Clean and preprocess text for NLP analysis"""
	if pd.isna(text):
		return ""
	text = str(text).lower()
	text = re.sub(r'[^a-zA-Z\s]', '', text)
	text = ' '.join(text.split())
	return text

def preprocess_data(input_csv= r"D:\DES646_Project\Womens Clothing E-Commerce Reviews.csv", output_csv='../outputs/clean_csv.csv'):
	df = pd.read_csv(input_csv)
	drop_cols = [col for col in ['Recommended IND', 'Positive Feedback Count', 'Division Name', 'Unnamed: 0'] if col in df.columns]
	df_new = df.drop(columns=drop_cols)
	# Drop rows with missing key columns
	df_new = df_new.dropna(subset=['Review Text', 'Department Name', 'Class Name']).reset_index(drop=True)
	# Clean text columns
	df_new['Clean_Title'] = df_new['Review Text'].apply(clean_text)
	df_new['Clean_Review Text'] = df_new['Review Text'].apply(clean_text)
	# Save cleaned data
	df_new.to_csv(output_csv, index=False)
	print(f"Preprocessed data saved to {output_csv}")

if __name__ == "__main__":
	preprocess_data()