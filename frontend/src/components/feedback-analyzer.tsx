"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { analyzeFeedbackWithRAG, type RAGSource } from "@/ai/flows/rag-feedback-analyzer";
import { RatingStars } from "@/components/rating-stars";

interface FeedbackAnalyzerProps {
  allReviews: string[];
}

export function FeedbackAnalyzer({ allReviews }: FeedbackAnalyzerProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [sources, setSources] = useState<RAGSource[] | null>(null);
  const [includeSources, setIncludeSources] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
  setResponse("");
  setSources(null);
  setIncludeSources(false);

    try {
      const reviewsContext = allReviews.join("\n\n---\n\n");
      const result = await analyzeFeedbackWithRAG({ query, context: reviewsContext });
      setResponse(result.answer);
      setSources(result.sources ?? null);
      setIncludeSources(!!result.include_sources);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      setResponse("Sorry, there was an error getting a response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
          Ask the Feedback Analyzer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., What are common issues in Tops?"
            className="min-h-[100px]"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !query.trim()} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Get Insights
          </Button>
        </form>

        {(isLoading || response) && (
          <div className="mt-6">
            <h4 className="font-semibold mb-2">AI Response:</h4>
            <ScrollArea className="h-64 w-full rounded-md border bg-muted/50 p-4">
              {isLoading && !response && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              {response && (
                <>
                    <Badge>AI Analyzed</Badge>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{response}</p>
                    {includeSources && sources && sources.length > 0 && (
                      <div className="mt-4">
                        <h5 className="font-medium">Sources</h5>
                        <ul className="mt-2 space-y-3">
                          {sources.slice(0, 5).map((s, idx) => {
                            const md = (s.metadata || {}) as Record<string, any>;
                            const title = md["Title"] || md["title"] || `Snippet ${idx + 1}`;
                            const clothingId = md["Clothing ID"] || md["clothing_id"] || md["id"];
                            const age = md["Age"] || md["age"];
                            const rawRating = md["Rating"] ?? md["rating"] ?? md["Score"] ?? md["score"]; 
                            const rating = typeof rawRating === 'number' ? rawRating : parseFloat(String(rawRating ?? 'NaN'));
                            return (
                              <li key={idx} className="rounded border p-3 bg-background">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold flex items-center gap-2">
                                    <span>{title}</span>
                                    {clothingId && (
                                      <span className="text-xs text-muted-foreground">(ID: {String(clothingId)})</span>
                                    )}
                                    {age && (
                                      <span className="text-xs text-muted-foreground">Age: {String(age)}</span>
                                    )}
                                  </div>
                                  {Number.isFinite(rating) && rating > 0 && (
                                    <div className="flex items-center gap-2">
                                      <RatingStars rating={Math.max(0, Math.min(5, Number(rating)))} />
                                      <span className="text-xs text-muted-foreground">{Number(rating).toFixed(1)}/5</span>
                                    </div>
                                  )}
                                </div>
                                {s.text_snippet && (
                                  <p className="text-xs mt-1 text-muted-foreground whitespace-pre-wrap">{s.text_snippet}</p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                </>
              )}
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}