'use server';
/**
 * @fileOverview A RAG-based AI agent for analyzing product feedback.
 *
 * - analyzeFeedbackWithRAG - A function that answers questions about product feedback using a RAG pattern.
 * - RAGInput - The input type for the function.
 * - RAGOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RAGInputSchema = z.object({
  query: z.string().describe('The user\'s question about the product feedback.'),
  context: z.string().describe('A collection of all relevant product reviews and feedback.'),
});
export type RAGInput = z.infer<typeof RAGInputSchema>;

const RAGOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user\'s query.'),
});
export type RAGOutput = z.infer<typeof RAGOutputSchema>;

export async function analyzeFeedbackWithRAG(input: RAGInput): Promise<RAGOutput> {
  return ragFlow(input);
}

const ragPrompt = ai.definePrompt({
  name: 'ragFeedbackPrompt',
  input: { schema: RAGInputSchema },
  output: { schema: RAGOutputSchema },
  prompt: `You are an expert product feedback analyst for a fashion e-commerce company.
Your goal is to answer questions from product designers based on a provided set of customer reviews.
Use only the information from the reviews (context) to answer the user's query.
Be concise and focus on actionable insights. Synthesize information from multiple reviews if possible.

CONTEXT (Customer Reviews):
---
{{{context}}}
---

USER QUERY:
"{{{query}}}"

Based on the reviews, provide a clear and helpful answer to the query.
`,
});

const ragFlow = ai.defineFlow(
  {
    name: 'ragFeedbackFlow',
    inputSchema: RAGInputSchema,
    outputSchema: RAGOutputSchema,
  },
  async (input) => {
    const { output } = await ragPrompt(input);
    return output!;
  }
);