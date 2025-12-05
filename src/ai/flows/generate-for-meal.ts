'use server';

/**
 * @fileOverview Generates a recipe for a specific meal name.
 *
 * - generateForMeal - A function that handles the recipe generation.
 * - GenerateForMealInput - The input type for the generateForMeal function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GenerateRecipesOutputSchema, RecipeSchema } from './schemas';
import type { GenerateRecipesOutput } from './schemas';


const GenerateForMealInputSchema = z.object({
  mealName: z.string().describe('The name of the meal to generate a recipe for.'),
});
export type GenerateForMealInput = z.infer<typeof GenerateForMealInputSchema>;


const mealPrompt = ai.definePrompt({
    name: 'mealPrompt',
    input: { schema: GenerateForMealInputSchema },
    output: { schema: GenerateRecipesOutputSchema },
    prompt: `You are a creative chef. A user has shown you a picture of a meal, which has been identified as "{{mealName}}".

Generate one detailed recipe for "{{mealName}}".

The recipe should include:
- A title for the recipe.
- A list of ingredients.
- Step-by-step instructions.
- A recommended serving size.
- Estimated nutritional information (calories, protein, carbs, fat).

Present the final recipe in the required JSON format.`,
});

const generateForMealFlow = ai.defineFlow(
    {
        name: 'generateForMealFlow',
        inputSchema: GenerateForMealInputSchema,
        outputSchema: GenerateRecipesOutputSchema,
    },
    async (input) => {
        const { output } = await mealPrompt(input);
        return output!;
    }
);

export async function generateForMeal(input: GenerateForMealInput): Promise<GenerateRecipesOutput> {
    return generateForMealFlow(input);
}
