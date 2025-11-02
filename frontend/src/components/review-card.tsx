import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RatingStars } from "./rating-stars";
import type { Review } from "@/lib/types";
// Note: We intentionally removed auto AI tag generation to avoid API rate limits.

export function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold font-headline">{review.author || review.title || "Anonymous"}</p>
                {/* Removed date from feedbacks as requested */}
                {(review.age || review.clothingId) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {review.age ? `Age: ${review.age}` : ''}
                    {review.age && review.clothingId ? ' • ' : ''}
                    {review.clothingId ? `Clothing ID: ${review.clothingId}` : ''}
                  </p>
                )}
            </div>
            <RatingStars rating={review.rating} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground/80 italic">"{review.text}"</p>
      </CardContent>
    </Card>
  );
}
