'use server';

/**
 * @fileOverview A customer feedback analysis AI agent.
 *
 * - analyzeCustomerFeedback - A function that handles the customer feedback analysis process.
 * - AnalyzeCustomerFeedbackInput - The input type for the analyzeCustomerFeedback function.
 * - AnalyzeCustomerFeedbackOutput - The return type for the analyzeCustomerFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCustomerFeedbackInputSchema = z.object({
  feedback: z
    .string()
    .describe('The customer feedback text to be analyzed.'),
  productName: z.string().describe('The name of the product being reviewed.'),
});
export type AnalyzeCustomerFeedbackInput = z.infer<typeof AnalyzeCustomerFeedbackInputSchema>;

const AnalyzeCustomerFeedbackOutputSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('The overall sentiment of the feedback.'),
  emotion: z.string().describe('The primary emotion expressed in the feedback.'),
  intent: z.string().describe('The main intent of the customer in the feedback.'),
  tags: z.array(z.string()).describe('Relevant tags or keywords extracted from the feedback.'),
});
export type AnalyzeCustomerFeedbackOutput = z.infer<typeof AnalyzeCustomerFeedbackOutputSchema>;

export async function analyzeCustomerFeedback(input: AnalyzeCustomerFeedbackInput): Promise<AnalyzeCustomerFeedbackOutput> {
  return analyzeCustomerFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCustomerFeedbackPrompt',
  input: {schema: AnalyzeCustomerFeedbackInputSchema},
  output: {schema: AnalyzeCustomerFeedbackOutputSchema},
  prompt: `You are an AI specializing in analyzing customer feedback for products.

  Analyze the following customer feedback for the product "{{productName}}" and determine the sentiment, emotion, and intent of the customer.
  Also, extract relevant tags or keywords from the feedback.

  Feedback: {{{feedback}}}

  Provide the output in JSON format.
  Make sure the sentiment is one of "positive", "negative", or "neutral".
  The emotion and intent should be a short phrase, maximum of 5 words.
  The tags should be an array of strings.
  `,
});

const analyzeCustomerFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeCustomerFeedbackFlow',
    inputSchema: AnalyzeCustomerFeedbackInputSchema,
    outputSchema: AnalyzeCustomerFeedbackOutputSchema,
  },
  async input => {
    // Try the LLM prompt with retries and exponential backoff on rate-limit or transient errors.
    const maxRetries = 3;
    let attempt = 0;

    async function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    while (true) {
      try {
        const {output} = await prompt(input);
        return output!;
      } catch (err: any) {
        attempt++;
        const msg = String(err?.message || err);

        // If it's a rate limit / quota error (429) or network glitch, retry with backoff.
        const isRetryable = /quota exceeded|429|Too Many Requests|rate limit/i.test(msg);

        if (attempt <= maxRetries && isRetryable) {
          const backoff = Math.round(1000 * Math.pow(2, attempt - 1));
          // jitter
          const jitter = Math.round(Math.random() * 300);
          await sleep(backoff + jitter);
          continue;
        }

        // If retries exhausted or non-retryable, fall back to a lightweight heuristic analyzer.
        console.warn('LLM call failed or quota exceeded, falling back to heuristic analysis:', msg);
        const heuristic = heuristicAnalyze(input.feedback);
        return heuristic as any;
      }
    }
  }
);

// Simple heuristic fallback: keyword-based sentiment and tag extraction.
function heuristicAnalyze(feedback: string) {
  const posWords = ['good', 'great', 'excellent', 'love', 'perfect', 'comfortable', 'best', 'nice', 'amazing', 'recommend'];
  const negWords = ['bad', 'poor', 'terrible', 'disappointed', 'hate', 'awful', 'broken', 'worst', 'cheap', 'problem'];

  const text = (feedback || '').toLowerCase();
  let posCount = 0;
  let negCount = 0;
  const tags = new Set<string>();

  for (const w of posWords) if (text.includes(w)) { posCount++; tags.add(w); }
  for (const w of negWords) if (text.includes(w)) { negCount++; tags.add(w); }

  const sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';

  // crude emotion/intent guesses
  const emotion = posCount > negCount ? 'satisfied' : negCount > posCount ? 'frustrated' : 'indifferent';
  const intent = text.includes('return') || text.includes('refund') ? 'request refund' : text.includes('buy') ? 'purchase intent' : 'give feedback';

  return {
    sentiment: sentiment as 'positive' | 'negative' | 'neutral',
    emotion,
    intent,
    tags: Array.from(tags).slice(0, 8),
  };
}
