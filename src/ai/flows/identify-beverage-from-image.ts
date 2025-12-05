
'use server';
/**
 * @fileOverview Identifies beverage-related items from an image.
 *
 * - identifyBeverageFromImage - A function that handles the image identification process.
 * - IdentifyBeverageFromImageInput - The input type for the function.
 * - IdentifyBeverageFromImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IdentifyBeverageFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of ingredients, bottles, or a prepared beverage, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyBeverageFromImageInput = z.infer<typeof IdentifyBeverageFromImageInputSchema>;

const IdentifyBeverageFromImageOutputSchema = z.object({
  isPreparedDrink: z.boolean().describe('Whether the image is of a single prepared beverage or a collection of ingredients/bottles.'),
  items: z.array(z.string()).describe('If isPreparedDrink is true, an array with a single item: the name of the beverage (e.g., "Margarita"). If false, an array of all identified ingredients and bottle brand names (e.g., "Limes", "Tanqueray Gin", "Oranges").'),
});
export type IdentifyBeverageFromImageOutput = z.infer<typeof IdentifyBeverageFromImageOutputSchema>;

const identifyBeveragePrompt = ai.definePrompt({
    name: 'identifyBeveragePrompt',
    input: { schema: IdentifyBeverageFromImageInputSchema },
    output: { schema: IdentifyBeverageFromImageOutputSchema },
    prompt: `Analyze the following image. Determine if it's a picture of multiple beverage ingredients (like bottles of spirits, mixers, fruits on a bar) or if it's a single, prepared beverage in a glass.

- If it's a collection of ingredients/bottles, set "isPreparedDrink" to false and list all the items you can identify (including brand names on bottles if visible) in the "items" array.
- If it's a single prepared beverage, set "isPreparedDrink" to true and provide the name of the beverage as a single element in the "items" array (e.g., ["Old Fashioned"]).

Image: {{media url=photoDataUri}}`,
});

const identifyBeverageFromImageFlow = ai.defineFlow(
    {
        name: 'identifyBeverageFromImageFlow',
        inputSchema: IdentifyBeverageFromImageInputSchema,
        outputSchema: IdentifyBeverageFromImageOutputSchema,
    },
    async (input) => {
        const { output } = await identifyBeveragePrompt(input);
        return output!;
    }
);

export async function identifyBeverageFromImage(input: IdentifyBeverageFromImageInput): Promise<IdentifyBeverageFromImageOutput> {
    return identifyBeverageFromImageFlow(input);
}

    