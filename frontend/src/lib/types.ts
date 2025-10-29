export type Review = {
  id: number;
  author: string;
  date: string;
  rating: number; // 1-5
  text: string;
};

export type Product = {
  id: string;
  name: string;
  department: string;
  productAge: string; // e.g., "3 months"
  imageId: string; // to link to placeholder-images.json
  reviews: Review[];
};

export type Department = {
  name: string;
  classes: Product[];
};