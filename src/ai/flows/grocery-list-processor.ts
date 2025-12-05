'use server';
/**
 * @fileOverview An AI agent to process grocery lists from text or images into structured data.
 *
 * - processGroceryList - A function that handles the grocery list processing.
 * - ProcessGroceryListInput - The input type for the function.
 * - ProcessGroceryListOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GroceryListOutputSchema } from './schemas';

const ProcessGroceryListInputSchema = z.object({
  list: z.string().optional().describe('The raw text of the grocery list, with each item on a new line.'),
  photoDataUri: z.string().optional().describe("A photo of a grocery list as a data URI ('data:<mimetype>;base64,<encoded_data>')."),
  region: z.string().optional().describe('The user\'s city or region for local price estimation (e.g., "Kingston, Jamaica" or "Miami, FL").'),
});
export type ProcessGroceryListInput = z.infer<typeof ProcessGroceryListInputSchema>;

export type ProcessGroceryListOutput = z.infer<typeof GroceryListOutputSchema>;

const groceryPrompt = ai.definePrompt({
    name: 'groceryListProcessorPrompt',
    input: { schema: ProcessGroceryListInputSchema },
    output: { schema: GroceryListOutputSchema },
    prompt: `You are an expert grocery list organizer and cost estimator. Your task is to take a raw text list OR an image of a list, organize it into logical categories, and provide an estimated cost for each item and a total cost.

    {{#if list}}
    User's Raw List:
    {{{list}}}
    {{/if}}

    {{#if photoDataUri}}
    Image of User's List:
    {{media url=photoDataUri}}
    {{/if}}
    
    User's Location: {{#if region}}"{{{region}}}"{{else}}"USA"{{/if}}

    **Your Process:**
    1.  **Extract Text**: If an image is provided, perform OCR to accurately extract all items from the list. If text is provided, use that directly.
    2.  **Analyze the List:** Read each line and identify the item, its quantity, and any units. Correct minor typos.
    3.  **Categorize Items:** Group all items into logical supermarket categories (e.g., "Meat & Poultry", "Produce", "Bakery", "Dairy & Cheese", "Canned Goods", "Snacks", "Beverages", "Household").
    4.  **Estimate Costs:**
        *   Determine the local currency based on the provided region (e.g., "Kingston, Jamaica" -> JMD, "Miami, FL" -> USD). Default to USD if the region is generic.
        *   For each item, estimate its market price in that currency. Be realistic. If a brand is mentioned (e.g., "Grace mackerel"), use that to inform the price.
        *   Calculate the subtotal for each item based on its quantity and estimated unit price.
    5.  **Calculate Total:** Sum up the costs of all items to get a grand total.
    6.  **Generate a Title:** Create a simple, clear title for the list, like "Weekly Groceries".
    7.  **Format the Output:** Return a single JSON object that matches the required output schema precisely. Ensure all costs are numbers.`,
});

const groceryListFlow = ai.defineFlow(
    {
      name: 'groceryListFlow',
      inputSchema: ProcessGroceryListInputSchema,
      outputSchema: GroceryListOutputSchema,
    },
    async (input) => {
      const { output } = await groceryPrompt(input);
      return output!;
    }
);

export async function processGroceryList(input: ProcessGroceryListInput): Promise<ProcessGroceryListOutput> {
    return groceryListFlow(input);
}
