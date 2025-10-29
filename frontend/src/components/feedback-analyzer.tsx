"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { analyzeFeedbackWithRAG } from "@/ai/flows/rag-feedback-analyzer";

interface FeedbackAnalyzerProps {
  allReviews: string[];
}

export function FeedbackAnalyzer({ allReviews }: FeedbackAnalyzerProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setResponse("");

    try {
        const reviewsContext = allReviews.join("\n\n---\n\n");
      const result = await analyzeFeedbackWithRAG({ query, context: reviewsContext });
      setResponse(result.answer);
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
                </>
              )}
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}