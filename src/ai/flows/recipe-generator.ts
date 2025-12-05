
'use server';

/**
 * @fileOverview A recipe generation AI agent.
 *
 * - generateRecipes - A function that handles the recipe generation process.
 * - GenerateRecipesInput - The input type for the generateRecipes function.
 * - GenerateRecipesOutput - The return type for the generateRecipes function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GenerateRecipesOutputSchema } from './schemas';
import type { GenerateRecipesOutput } from './schemas';


const GenerateRecipesInputSchema = z.object({
  ingredients: z.array(z.string()).describe('The list of available ingredients.'),
  dietaryRestrictions: z.array(z.string()).optional().describe('A list of dietary restrictions (e.g., Vegetarian, Gluten-Free).'),
  cuisine: z.string().optional().describe('A preferred cuisine type (e.g., Italian, Mexican).'),
});
export type GenerateRecipesInput = z.infer<typeof GenerateRecipesInputSchema>;

const recipePrompt = ai.definePrompt({
    name: 'recipePrompt',
    input: { schema: GenerateRecipesInputSchema },
    output: { schema: GenerateRecipesOutputSchema },
    prompt: `You are a practical and creative chef. Your goal is to generate 3 diverse recipe ideas based on the user's available ingredients and preferences.

    Available Ingredients:
    {{{ingredients}}}
    
    User Preferences:
    - Dietary Restrictions: {{{dietaryRestrictions}}}
    - Cuisine: {{{cuisine}}}

    **Your Process:**
    1.  **Generate a Diverse Mix:** Create a mix of recipes. The first recipe should be simple and use as few ingredients as possible from the provided list. The next two recipes can be more creative and might suggest one or two common additional ingredients. Prioritize recipes that are easy to make.
    2.  **Enrich with Data:** For each recipe, you must provide:
        *   A **title**.
        *   An engaging **description** including cuisine and meal type.
        *   A full list of **ingredients** with measurements.
        *   Step-by-step **instructions**.
        *   A recommended **servingSize**.
        *   The number of **missingIngredientsCount** by comparing the recipe's needs to the user's "Available Ingredients".
        *   An estimated **nutritionalInfo** object (calories, protein, carbs, fat).
        *   An estimated **costInfo** object with a 'totalCost' in USD.
    3.  **IMPORTANT**: Do not generate an image or an imageUrl. The user will generate this separately.
    
    Present the final recipes in a clear format. If a cuisine is not specified, generate recipes from a variety of different cuisines (e.g., Asian, European, Latin American, Caribbean, etc.).`
});

const generateRecipesFlow = ai.defineFlow(
    {
      name: 'generateRecipesFlow',
      inputSchema: GenerateRecipesInputSchema,
      outputSchema: GenerateRecipesOutputSchema,
    },
    async (input) => {
      const { output } = await recipePrompt(input);
      return output!;
    }
);

export async function generateRecipes(input: GenerateRecipesInput): Promise<GenerateRecipesOutput> {
    return generateRecipesFlow(input);
}
