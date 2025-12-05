
'use server';

/**
 * @fileOverview A beverage and cocktail recipe generation AI agent.
 *
 * - generateBeverages - A function that handles the beverage recipe generation process.
 * - GenerateBeveragesInput - The input type for the function.
 * - GenerateBeveragesOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BeverageRecipeSchema } from './schemas';

const GenerateBeveragesInputSchema = z.object({
  ingredients: z.array(z.string()).describe('The list of available ingredients (e.g., fruits, mixers, spirits).'),
  preferences: z.array(z.string()).optional().describe('A list of preferences (e.g., Non-alcoholic, Strong, Sweet, Sour).'),
});
export type GenerateBeveragesInput = z.infer<typeof GenerateBeveragesInputSchema>;

const GenerateBeveragesOutputSchema = z.object({
  beverages: z.array(BeverageRecipeSchema).describe('A list of generated beverage recipes.'),
});
export type GenerateBeveragesOutput = z.infer<typeof GenerateBeveragesOutputSchema>;

const beveragePrompt = ai.definePrompt({
    name: 'beveragePrompt',
    input: { schema: GenerateBeveragesInputSchema },
    output: { schema: GenerateBeveragesOutputSchema },
    prompt: `You are an expert mixologist. Your goal is to generate 3 diverse beverage or cocktail recipes based on the user's available ingredients and preferences.

    Available Ingredients:
    {{{ingredients}}}
    
    User Preferences:
    - Preferences: {{{preferences}}}

    **Your Process:**
    1.  **Analyze Ingredients:** Identify potential spirits, mixers, fruits, and garnishes from the ingredient list.
    2.  **Consider Preferences:** If the user specifies "Non-alcoholic", generate only mocktails or other non-alcoholic drinks. Use other preferences like "sweet" or "strong" to guide the style of the drinks.
    3.  **Generate a Diverse Mix:** Create a mix of recipes. If alcohol is present, create at least one classic cocktail and one creative, modern one. If no alcohol, create a mix of interesting mocktails, juices, or teas.
    4.  **Enrich with Details:** For each recipe, provide a title, a full ingredient list with measurements (e.g., 2 oz, 1/2 cup), step-by-step mixing instructions, and a suggestion for the appropriate glassware.
    5.  **Write Description:** For each recipe, write a short, engaging 'description' of the drink, including its style (e.g., classic cocktail, refreshing mocktail) and flavor profile (e.g., sweet, sour, bitter).
    6.  **IMPORTANT**: Do not generate an image or an imageUrl. The user will generate this separately.
    
    Present the final recipes in a clear format.`,
});

const generateBeveragesFlow = ai.defineFlow(
    {
      name: 'generateBeveragesFlow',
      inputSchema: GenerateBeveragesInputSchema,
      outputSchema: GenerateBeveragesOutputSchema,
    },
    async (input) => {
      const { output } = await beveragePrompt(input);
      return output!;
    }
);

export async function generateBeverages(input: GenerateBeveragesInput): Promise<GenerateBeveragesOutput> {
    return generateBeveragesFlow(input);
}
