import os
import pandas as pd
from rag import RAGbot

if __name__ == "__main__":
    # Adjust paths as needed
    csv_path = r"D:\DES646-Project\outputs\clean_csv.csv"
    native_dir = r"D:\DES646-Project\faiss_index_native"

    df = pd.read_csv(csv_path)
    # Create RAGbot without forcing rebuild of existing local langchain index
    r = RAGbot(df, persist_path=r"D:\DES646-Project\faiss_index", force_rebuild=True)
    print("Exporting native FAISS index (this may take some minutes)...")
    r.export_native_index(native_dir)
    print("Done.")
