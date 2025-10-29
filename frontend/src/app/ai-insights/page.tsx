import { products } from '@/lib/data';
import { FeedbackAnalyzer } from '@/components/feedback-analyzer';

export default function AiInsightsPage() {
  const allReviews = products.flatMap(p => p.reviews.map(r => r.text));
  
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
       <header className="mb-8">
        <h1 className="text-5xl font-bold tracking-tight">AI Insights (RAG)</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Ask the Feedback Analyzer anything about your product reviews.
        </p>
      </header>
      <FeedbackAnalyzer allReviews={allReviews} />
    </div>
  );
}
