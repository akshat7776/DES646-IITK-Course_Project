import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Review } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAverageRating(reviews: {rating: number}[]): number {
  if (reviews.length === 0) {
    return 0;
  }
  const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
  return totalRating / reviews.length;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getNPSCategory(rating: number): 'promoter' | 'passive' | 'detractor' {
    if (rating >= 4) return 'promoter'; // 4-5 stars
    if (rating === 3) return 'passive'; // 3 stars
    return 'detractor'; // 1-2 stars
}