export type Review = {
  id: number;
  author: string;
  date: string;
  rating: number; 
  text: string;
  // Optional fields carried from CSV when available
  title?: string;
  age?: number;
  clothingId?: number;
};

export type Product = {
  id: string;
  name: string;
  department: string;
  productAge: string; 
  imageId: string; // to link to placeholder-images.json
  reviews: Review[];
};

export type Department = {
  name: string;
  classes: Product[];
};