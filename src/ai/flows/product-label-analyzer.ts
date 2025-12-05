'use server';
/**
 * @fileOverview An AI agent to analyze food product labels from text or images.
 *
 * - analyzeProductLabel - A function that handles the product label analysis.
 * - AnalyzeProductLabelInput - The input type for the function.
 * - ProductLabelCardSchema - The Zod schema for the output.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ProductLabelCardSchema } from './schemas';

const AnalyzeProductLabelInputSchema = z.object({
  productName: z.string().optional().describe('The partial or full name of the product.'),
  ingredientsText: z.string().optional().describe('The raw text of the ingredients list, potentially incomplete.'),
  photoDataUri: z.string().optional().describe("A photo of the product, its label, or barcode as a data URI ('data:<mimetype>;base64,<encoded_data>')."),
});
export type AnalyzeProductLabelInput = z.infer<typeof AnalyzeProductLabelInputSchema>;

export type AnalyzeProductLabelOutput = z.infer<typeof ProductLabelCardSchema>;

// Step 1: A new prompt to identify the product and get its full ingredient list.
const productIdentifierPrompt = ai.definePrompt({
    name: 'productIdentifierPrompt',
    input: { schema: AnalyzeProductLabelInputSchema },
    output: { schema: z.object({
        identifiedProductName: z.string().describe("The full, official name of the identified product."),
        identifiedIngredients: z.string().describe("The complete, official list of ingredients for the identified product."),
    })},
    prompt: `You are a product recognition expert. Based on the following partial information (a partial name, an incomplete ingredient list, or a photo), your first task is to identify the exact product and find its complete, official ingredient list.

    **Input:**
    {{#if productName}}
    - Product Name: "{{productName}}"
    {{/if}}
    {{#if ingredientsText}}
    - Ingredients List: "{{ingredientsText}}"
    {{/if}}
    {{#if photoDataUri}}
    - Product Image: {{media url=photoDataUri}} (Use OCR and image recognition).
    {{/if}}
    
    **Your Process:**
    1.  **Analyze Input**: Combine all provided clues to determine the most likely product.
    2.  **Find Official Data**: Search your knowledge base for the official product name and its full ingredient list as it would appear on the packaging.
    3.  **Return Identification**: Output the full product name and the complete ingredient list in the required JSON format.`,
});

// Step 2: The original analysis prompt, now expecting complete information.
const productLabelPrompt = ai.definePrompt({
    name: 'productLabelAnalyzerPrompt',
    input: { schema: z.object({
        productName: z.string().describe('The full name of the product.'),
        ingredientsText: z.string().describe('The complete list of ingredients.'),
    }) },
    output: { schema: ProductLabelCardSchema },
    prompt: `You are an expert food scientist and nutritionist. Your task is to analyze a food product based on its full name and complete ingredients list and provide a detailed evaluation card. Use the provided scoring system.

    **Input:**
    - Product Name: "{{productName}}"
    - Ingredients List: "{{ingredientsText}}"

    **Scoring System:**

    1.  **Nutritional Value (out of 60 points):** Based on energy density, sugar, salt, saturated fat, fiber, and protein.
    2.  **Ingredient Quality (out of 40 points):** Based on additives, preservatives, colorants, and processing level.
    3.  **Total Score:** A weighted average out of 100.

    **Ingredient Risk Categories:**
    - **Risk-Free (Green):** Natural, safe, beneficial.
    - **Low Risk (Yellow):** Generally safe, mild effects (e.g., salt, sugar in moderation).
    - **Moderate Risk (Orange):** Linked to potential adverse effects with high consumption.
    - **Hazardous (Red):** Associated with significant health concerns.

    **Scoring Logic:**
    - If a hazardous (Red) ingredient is present -> total score must be ≤ 25/100.
    - If a moderate-risk (Orange) ingredient is the highest risk -> total score must be ≤ 50/100.
    - Green/Yellow products can score up to 100.

    **Penalties:**
    - High sugar (>15g per 100g)
    - Excess sodium (>600mg per 100g)
    - High saturated fat (>5g per 100g)
    - Ultra-processed (NOVA 4)
    - Synthetic dyes, nitrites.

    **Bonuses:**
    - High fiber (>3g per 100g)
    - High protein (>10g per 100g)
    - Whole grains, unprocessed ingredients.
    - Natural antioxidants, beneficial nutrients.
    - Organic certification.

    **Your Process:**
    1.  **Analyze Each Ingredient:** For every ingredient, determine its purpose (e.g., colorant, preservative) and assign a risk level ('Risk-Free', 'Low Risk', 'Moderate Risk', 'Hazardous'). Provide a brief, one-sentence explanation for the assigned risk.
    2.  **Calculate Scores:** Determine the Nutritional Score, Ingredient Score, and the final Overall Score based on the criteria.
    3.  **Determine Overall Risk:** The overall risk is determined by the highest risk ingredient (e.g., if one ingredient is 'Hazardous', the overall risk is 'Hazardous').
    4.  **Summarize Findings:** Provide a concise summary explaining the final score, highlighting the main pros and cons.
    5.  **Format the Output:** Return a single JSON object that matches the \`ProductLabelCardSchema\` precisely. Ensure all scores are numbers and the product name is the one provided in the input.`,
});

const productLabelAnalyzerFlow = ai.defineFlow(
    {
      name: 'productLabelAnalyzerFlow',
      inputSchema: AnalyzeProductLabelInputSchema,
      outputSchema: ProductLabelCardSchema,
    },
    async (input) => {
      // Step 1: Run the identification prompt to get full product details.
      const { output: identifiedProduct } = await productIdentifierPrompt(input);
      if (!identifiedProduct) {
        throw new Error("Could not identify the product from the provided information.");
      }

      // Step 2: Use the identified details to run the analysis prompt.
      const { output: analysisResult } = await productLabelPrompt({
          productName: identifiedProduct.identifiedProductName,
          ingredientsText: identifiedProduct.identifiedIngredients,
      });

      if (!analysisResult) {
        throw new Error("Could not analyze the identified product.");
      }

      // Step 3: Pass through the image URI if it was provided in the original input
      return {
        ...analysisResult,
        imageUrl: input.photoDataUri || undefined,
      };
    }
);

export async function analyzeProductLabel(input: AnalyzeProductLabelInput): Promise<AnalyzeProductLabelOutput> {
    return productLabelAnalyzerFlow(input);
}
