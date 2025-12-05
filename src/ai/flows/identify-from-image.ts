'use server';
/**
 * @fileOverview Identifies food items from an image and generates a recipe.
 *
 * - identifyFromImage - A function that handles the image identification and recipe generation process.
 * - IdentifyFromImageInput - The input type for the identifyFromImage function.
 * - IdentifyFromImageOutput - The return type for the identifyFromImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { RecipeSchema } from './schemas';

const IdentifyFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of ingredients or a meal, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyFromImageInput = z.infer<typeof IdentifyFromImageInputSchema>;

const IdentifyFromImageOutputSchema = z.object({
  isMeal: z.boolean().describe('Whether the image is of a single prepared meal or a collection of ingredients.'),
  items: z.array(z.string()).describe('If isMeal is true, an array with a single item: the name of the meal. If isMeal is false, an array of all identified ingredients.'),
  generatedRecipe: RecipeSchema.optional().describe('A fully generated recipe if the image is a recognizable meal.'),
});
export type IdentifyFromImageOutput = z.infer<typeof IdentifyFromImageOutputSchema>;

const identifyPrompt = ai.definePrompt({
    name: 'identifyPrompt',
    input: { schema: IdentifyFromImageInputSchema },
    output: { schema: IdentifyFromImageOutputSchema },
    prompt: `Analyze this image of food. Your primary goal is to identify the food items and generate a single, complete recipe.

**Your Process:**

1.  **Analyze the Image:**
    *   If the image contains **multiple raw ingredients** (e.g., vegetables on a cutting board, items in a pantry), identify all of them. Set the 'isMeal' flag to \`false\`, and list every identified ingredient in the 'items' array. Then, generate one cohesive recipe using those identified ingredients as the primary components.
    *   If the image shows a **single prepared meal** (e.g., a plate of pasta, a finished dish), identify the name of the meal. Set the 'isMeal' flag to \`true\`, and put only the identified "Dish Name" in the 'items' array. Then, generate a detailed recipe for that specific dish.

2.  **Generate the Recipe (\`generatedRecipe\` field):**
    *   **title**: The name of the dish.
    *   **ingredients**: A list of all necessary ingredients with quantities.
    *   **instructions**: Step-by-step preparation and cooking instructions.
    *   **servingSize**: A recommended serving size (e.g., "2-4 servings").

**Example 1: Raw Ingredients**
*   **Image shows**: chicken breast, broccoli, soy sauce.
*   **Your Output**: \`isMeal: false\`, \`items: ["chicken breast", "broccoli", "soy sauce"]\`, and a \`generatedRecipe\` for "Chicken and Broccoli Stir-fry".

**Example 2: Prepared Meal**
*   **Image shows**: A plate of spaghetti with meat sauce.
*   **Your Output**: \`isMeal: true\`, \`items: ["Spaghetti Bolognese"]\`, and a \`generatedRecipe\` for "Spaghetti Bolognese".

**IMPORTANT**: Always generate a recipe in the \`generatedRecipe\` field, regardless of whether you identified raw ingredients or a finished meal.

Image: {{media url=photoDataUri}}`,
});

const identifyFromImageFlow = ai.defineFlow(
    {
        name: 'identifyFromImageFlow',
        inputSchema: IdentifyFromImageInputSchema,
        outputSchema: IdentifyFromImageOutputSchema,
    },
    async (input) => {
        const { output } = await identifyPrompt(input);
        return output!;
    }
);


export async function identifyFromImage(input: IdentifyFromImageInput): Promise<IdentifyFromImageOutput> {
    return identifyFromImageFlow(input);
}
