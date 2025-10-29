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
    const {output} = await prompt(input);
    return output!;
  }
);
