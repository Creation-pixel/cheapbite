
'use server';
/**
 * @fileOverview Generates a photorealistic image of a packaged product.
 *
 * - generateProductImage - A function that handles the image generation.
 * - GenerateProductImageInput - The input type for the function.
 * - GenerateProductImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const GenerateProductImageInputSchema = z.object({
  productName: z.string().describe('The full name of the product to generate an image for (e.g., "Coca-Cola Classic").'),
  summary: z.string().describe('A brief summary of the product, including its type (e.g., soda, cereal, snack).'),
  packagingHint: z.string().optional().describe('A hint about the packaging (e.g., "soda can", "cereal box", "bag of chips").'),
});
export type GenerateProductImageInput = z.infer<typeof GenerateProductImageInputSchema>;

const GenerateProductImageOutputSchema = z.object({
  imageUrl: z.string().describe("The data URI of the generated image."),
});
export type GenerateProductImageOutput = z.infer<typeof GenerateProductImageOutputSchema>;

const generateProductImageFlow = ai.defineFlow(
  {
    name: 'generateProductImageFlow',
    inputSchema: GenerateProductImageInputSchema,
    outputSchema: GenerateProductImageOutputSchema,
  },
  async (input) => {
    const packaging = input.packagingHint || "standard packaging";
    
    // Construct the prompt string directly
    const promptText = `Task: Create an ultra-photorealistic studio product shot of a consumer good.

Product Name: "${input.productName}"

Product Description: "${input.summary}"

Packaging Hint: "${packaging}"

**Instructions:**
1.  Analyze the Product Name and Description to understand what the product is (e.g., a carbonated soft drink, a breakfast cereal, a savory snack).
2.  Generate a high-resolution, photorealistic image of the product in its typical commercial packaging. For example, if it's a soda, show it in a can or bottle. If it's cereal, show it in a box.
3.  The product packaging should be clean, modern, and feature the text "${input.productName}" clearly and professionally. Do not add any other text.
4.  Place the product on a clean, neutral background (like a marble countertop or a simple studio setting) with professional lighting and realistic shadows.
5.  Focus entirely on the product itself. Do not include any people, hands, or other distracting elements. The final image should look like a professional advertisement.
`;
    
    const { media } = await ai.generate({
        model: googleAI.model('imagen-4.0-fast-generate-001'),
        prompt: promptText,
    });
    
    if (!media.url) {
        throw new Error('Image generation failed to return a URL.');
    }

    return { imageUrl: media.url };
  }
);

export async function generateProductImage(input: GenerateProductImageInput): Promise<GenerateProductImageOutput> {
  return generateProductImageFlow(input);
}
