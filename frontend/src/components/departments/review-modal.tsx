"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import type { Product } from "@/lib/types";
import { ReviewCard } from "@/components/review-card";
import { analyzeFeedbackWithRAG } from "@/ai/flows/rag-feedback-analyzer";

interface ReviewModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewModal({
  product,
  isOpen,
  onClose,
}: ReviewModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleAnalyzeFeedback = async () => {
    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const allReviewsText = product.reviews.map(r => r.text).join("\n\n");
      const query = `Summarize the customer feedback for ${product.name}. What are the main positive and negative points?`;
      const result = await analyzeFeedbackWithRAG({ query, context: allReviewsText });
      setAnalysisResult(result.answer);
    } catch (error) {
      console.error("Failed to analyze feedback:", error);
      setAnalysisResult("Sorry, I couldn't analyze the feedback at this time.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const onOpenChange = (open: boolean) => {
    if (!open) {
      setAnalysisResult(null);
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-headline">
            {product.name}
          </DialogTitle>
          <DialogDescription>
            Product ID: {product.id} &bull; Age: {product.productAge}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh]">
          <div className="flex flex-col gap-4">
             <h3 className="text-lg font-semibold">All Reviews ({product.reviews.length})</h3>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {product.reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col gap-4">
            <Button onClick={handleAnalyzeFeedback} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Analyze Feedback
            </Button>
            
            <div className="relative flex-1">
              <ScrollArea className="h-full rounded-md border bg-muted/50 p-4">
                {isLoading && (
                   <div className="flex items-center justify-center h-full">
                     <p className="text-muted-foreground">Generating insights...</p>
                   </div>
                )}
                {analysisResult && (
                    <div>
                        <Badge className="mb-2">AI Analyzed</Badge>
                        <p className="text-sm whitespace-pre-wrap">{analysisResult}</p>
                    </div>
                )}
                {!isLoading && !analysisResult && (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-center text-muted-foreground">
                            Click "Analyze Feedback" to generate an AI summary of these reviews.
                        </p>
                    </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}