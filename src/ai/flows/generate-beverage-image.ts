
'use server';
/**
 * @fileOverview Generates a photorealistic image of a beverage.
 *
 * - generateBeverageImage - A function that handles the image generation.
 * - GenerateBeverageImageInput - The input type for the function.
 * - GenerateBeverageImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const GenerateBeverageImageInputSchema = z.object({
  beverageName: z.string().describe('The name of the beverage to generate an image for.'),
  glassware: z.string().optional().describe('e.g., coupe, highball, rocks glass.'),
});
export type GenerateBeverageImageInput = z.infer<typeof GenerateBeverageImageInputSchema>;

const GenerateBeverageImageOutputSchema = z.object({
  imageUrl: z.string().describe("The data URI of the generated image."),
});
export type GenerateBeverageImageOutput = z.infer<typeof GenerateBeverageImageOutputSchema>;

const imageGenerationPrompt = ai.definePrompt(
  {
    name: 'beverageImageGenerationPrompt',
    input: { schema: GenerateBeverageImageInputSchema },
    prompt: `A 3D ultra-photorealistic image of a "{{beverageName}}", freshly prepared and served in a {{#if glassware}}{{glassware}}{{else}}suitable glass{{/if}} on a stylish bar counter.

The drink should have realistic textures, condensation on the glass if appropriate, and detailed garnishes to enhance realism.

Include natural studio lighting, accurate shadows, and a shallow depth of field as seen in professional beverage photography.

Focus on the drink itself — no people, hands, or text.

Bar-quality, appetizing, high-resolution, photorealistic render.`,
  },
);

const generateBeverageImageFlow = ai.defineFlow(
  {
    name: 'generateBeverageImageFlow',
    inputSchema: GenerateBeverageImageInputSchema,
    outputSchema: GenerateBeverageImageOutputSchema,
  },
  async (input) => {
    const finalPrompt = await imageGenerationPrompt(input);
    
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

export async function generateBeverageImage(input: GenerateBeverageImageInput): Promise<GenerateBeverageImageOutput> {
  return generateBeverageImageFlow(input);
}

    