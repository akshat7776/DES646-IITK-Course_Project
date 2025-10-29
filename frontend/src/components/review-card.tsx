import { generateSentimentTags } from "@/ai/flows/generate-sentiment-tags";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { RatingStars } from "./rating-stars";
import type { Review } from "@/lib/types";
import { Suspense } from "react";
import { Skeleton } from "./ui/skeleton";

async function SentimentTags({ text }: { text: string }) {
  try {
    const { tags } = await generateSentimentTags({ text });
    return (
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <Badge key={index} variant="secondary" className="capitalize">
            {tag}
          </Badge>
        ))}
      </div>
    );
  } catch (error) {
    console.error("Failed to generate sentiment tags:", error);
    return null;
  }
}

function TagsSkeleton() {
    return (
        <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-24" />
        </div>
    )
}

export function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold font-headline">{review.author}</p>
                <p className="text-xs text-muted-foreground">{formatDate(review.date)}</p>
            </div>
            <RatingStars rating={review.rating} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground/80 italic">"{review.text}"</p>
      </CardContent>
      <CardFooter>
        <Suspense fallback={<TagsSkeleton />}>
          <SentimentTags text={review.text} />
        </Suspense>
      </CardFooter>
    </Card>
  );
}
