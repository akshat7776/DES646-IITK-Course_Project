import { config } from 'dotenv';
config();

import '@/ai/flows/generate-sentiment-tags.ts';
import '@/ai/flows/analyze-customer-feedback.ts';
import '@/ai/flows/rag-feedback-analyzer.ts';
