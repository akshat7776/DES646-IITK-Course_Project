'use server';

/**
 * @fileOverview A Genkit flow for generating sentiment tags from customer reviews.
 *
 * - generateSentimentTags - A function that generates sentiment tags for a given text.
 * - SentimentTagsInput - The input type for the generateSentimentTags function.
 * - SentimentTagsOutput - The return type for the generateSentimentTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SentimentTagsInputSchema = z.object({
  text: z.string().describe('The text to analyze for sentiment and content.'),
});
export type SentimentTagsInput = z.infer<typeof SentimentTagsInputSchema>;

const SentimentTagsOutputSchema = z.object({
  tags: z.array(z.string()).describe('An array of tags representing the sentiment, emotion, and intent of the text.'),
});
export type SentimentTagsOutput = z.infer<typeof SentimentTagsOutputSchema>;

export async function generateSentimentTags(input: SentimentTagsInput): Promise<SentimentTagsOutput> {
  return generateSentimentTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sentimentTagsPrompt',
  input: {schema: SentimentTagsInputSchema},
  output: {schema: SentimentTagsOutputSchema},
  prompt: `You are an AI assistant specializing in sentiment analysis.
  Your task is to generate relevant tags based on the sentiment and content of customer reviews.
  These tags will be used to filter and categorize feedback based on specific aspects of the product.
  
  Analyze the following text and generate a list of tags that capture the key sentiments, emotions, and intents expressed in the text.
  The tags should be concise and descriptive.
  
  Text: {{{text}}}
  
  Example:
  Input: "I love this product! It's amazing and works perfectly."
  Output: {tags: ["positive", "amazing", "works perfectly"]}
  
  Input: "The product arrived damaged and the customer service was unhelpful."
  Output: {tags: ["negative", "damaged", "unhelpful customer service"]}
  
  Now, generate the tags for the given text.
  The output should be a JSON object with a "tags" field containing an array of strings.
  `,
});

const generateSentimentTagsFlow = ai.defineFlow(
  {
    name: 'generateSentimentTagsFlow',
    inputSchema: SentimentTagsInputSchema,
    outputSchema: SentimentTagsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
