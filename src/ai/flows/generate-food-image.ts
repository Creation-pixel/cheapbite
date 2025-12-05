'use server';
/**
 * @fileOverview Generates a photorealistic image of a food dish.
 *
 * - generateFoodImage - A function that handles the image generation.
 * - GenerateFoodImageInput - The input type for the function.
 * - GenerateFoodImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const GenerateFoodImageInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to generate an image for.'),
  servingStyle: z.string().optional().describe('e.g., bowl, plate, tray, cup, banana leaf.'),
  surfaceType: z.string().optional().describe('e.g., restaurant table, rustic wooden table, marble countertop.'),
  temperature: z.string().optional().describe('e.g., hot, cold, room temperature.'),
  isHot: z.boolean().optional().describe('A boolean indicating if the food is hot.'),
});
export type GenerateFoodImageInput = z.infer<typeof GenerateFoodImageInputSchema>;

const GenerateFoodImageOutputSchema = z.object({
  imageUrl: z.string().describe("The data URI of the generated image."),
});
export type GenerateFoodImageOutput = z.infer<typeof GenerateFoodImageOutputSchema>;

const imageGenerationPrompt = ai.definePrompt(
  {
    name: 'foodImageGenerationPrompt',
    input: { schema: GenerateFoodImageInputSchema },
    prompt: `A 3D ultra-photorealistic image of {{dishName}}, freshly prepared and beautifully plated in a {{#if servingStyle}}{{servingStyle}}{{else}}suitable dish{{/if}}, displayed on a {{#if surfaceType}}{{surfaceType}}{{else}}neutral background{{/if}}.

The dish is {{#if temperature}}{{temperature}}{{else}}at a typical serving temperature{{/if}}, with {{#if isHot}}visible steam and glossy moisture{{else}}realistic texture and freshness{{/if}} and detailed garnish to enhance realism.

Include natural lighting, accurate shadows, and cinematic depth of field as seen in professional food photography.

Focus on the main ingredients and plating details — no people, utensils, or text.

Restaurant-quality, appetizing, high-resolution, photorealistic render.`,
  },
);

const generateFoodImageFlow = ai.defineFlow(
  {
    name: 'generateFoodImageFlow',
    inputSchema: GenerateFoodImageInputSchema,
    outputSchema: GenerateFoodImageOutputSchema,
  },
  async (input) => {
    const finalPrompt = await imageGenerationPrompt({
        ...input,
        isHot: input.temperature === 'hot',
    });
    
    const { media } = await ai.generate({
        model: googleAI.model('imagen-4.0-fast-generate-001'),
        prompt: finalPrompt.text,
    });
    
    if (!media.url) {
        throw new Error('Image generation failed to return a URL.');
    }

    return { imageUrl: media.url };
  }
);

export async function generateFoodImage(input: GenerateFoodImageInput): Promise<GenerateFoodImageOutput> {
  return generateFoodImageFlow(input);
}
