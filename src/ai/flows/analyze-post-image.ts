'use server';
/**
 * @fileOverview Analyzes an image for post creation, identifies its category, and generates content.
 *
 * - analyzePostImage - A function that handles the image analysis and content generation.
 * - AnalyzePostImageInput - The input type for the function.
 * - AnalyzePostImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzePostImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo for a social media post, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzePostImageInput = z.infer<typeof AnalyzePostImageInputSchema>;

const AnalyzePostImageOutputSchema = z.object({
  category: z.enum(['Meal', 'Ingredients', 'Product', 'Grocery List', 'Other']).describe('The identified category of the image content.'),
  title: z.string().describe('A short, catchy title for the social media post based on the image.'),
  description: z.string().describe('A one or two-sentence descriptive and engaging caption for the post.'),
});
export type AnalyzePostImageOutput = z.infer<typeof AnalyzePostImageOutputSchema>;

const analyzeImagePrompt = ai.definePrompt({
    name: 'analyzePostImagePrompt',
    input: { schema: AnalyzePostImageInputSchema },
    output: { schema: AnalyzePostImageOutputSchema },
    prompt: `You are a social media assistant for a food-focused app. Analyze the following image and prepare content for a post.

    **Your Task:**
    1.  **Categorize the Image:** Determine the primary subject of the image. Is it a finished meal, a collection of raw ingredients, a commercial product, a handwritten or printed grocery list, or something else?
    2.  **Generate a Title:** Create a short, catchy title for the post.
    3.  **Generate a Description:** Write a one or two-sentence caption that is descriptive, engaging, and relevant to the image. For example, if it's a meal, describe how delicious it looks. If it's ingredients, talk about the potential of what can be made.

    Image: {{media url=photoDataUri}}`,
});

const analyzePostImageFlow = ai.defineFlow(
    {
        name: 'analyzePostImageFlow',
        inputSchema: AnalyzePostImageInputSchema,
        outputSchema: AnalyzePostImageOutputSchema,
    },
    async (input) => {
        const { output } = await analyzeImagePrompt(input);
        return output!;
    }
);

export async function analyzePostImage(input: AnalyzePostImageInput): Promise<AnalyzePostImageOutput> {
    return analyzePostImageFlow(input);
}
