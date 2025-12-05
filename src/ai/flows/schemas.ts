import { z } from 'zod';

export const NutritionalInfoSchema = z.object({
    calories: z.number().optional().describe('Estimated calories (kcal) per serving.'),
    protein: z.number().optional().describe('Grams of protein per serving.'),
    totalFat: z.number().optional().describe('Total grams of fat per serving.'),
    saturatedFat: z.number().optional().describe('Grams of saturated fat per serving.'),
    transFat: z.number().optional().describe('Grams of trans fat per serving.'),
    cholesterol: z.number().optional().describe('Milligrams of cholesterol per serving.'),
    sodium: z.number().optional().describe('Milligrams of sodium per serving.'),
    totalCarbohydrates: z.number().optional().describe('Total grams of carbohydrates per serving.'),
    dietaryFiber: z.number().optional().describe('Grams of dietary fiber per serving.'),
    totalSugars: z.number().optional().describe('Grams of total sugars per serving.'),
    addedSugars: z.number().optional().describe('Grams of added sugars per serving.'),
}).describe("Nutritional information for the recipe.");

export const CostInfoSchema = z.object({
    totalCost: z.number().optional().describe('Total estimated cost of the recipe in USD.'),
    ingredientCosts: z.array(z.object({
        name: z.string().describe('Name of the ingredient.'),
        cost: z.number().describe('Estimated cost of the ingredient in USD.'),
    })).optional().describe('Breakdown of cost per ingredient.'),
}).describe("Cost analysis for the recipe.");

export const RecipeSchema = z.object({
  title: z.string().describe('The title of the recipe.'),
  description: z.string().optional().describe('A brief, engaging description of the dish, including cuisine type, meal type (e.g., breakfast, dinner), and key characteristics (e.g., vegan, gluten-free).'),
  ingredients: z.array(z.string()).describe('A list of ingredients required for the recipe.'),
  instructions: z.array(z.string()).describe('Step-by-step cooking instructions.'),
  servingSize: z.string().describe('The recommended serving size.'),
  nutritionalInfo: NutritionalInfoSchema.optional(),
  costInfo: CostInfoSchema.optional(),
  missingIngredientsCount: z.number().optional().describe('The number of ingredients the user is missing to make this recipe.'),
  imageUrl: z.string().optional().describe('URL of an image for the recipe.'),
});

export const GenerateRecipesOutputSchema = z.object({
  recipes: z.array(RecipeSchema).describe('A list of generated recipes.'),
});
export type GenerateRecipesOutput = z.infer<typeof GenerateRecipesOutputSchema>;

export const BeverageRecipeSchema = z.object({
    title: z.string().describe('The title of the beverage or cocktail.'),
    description: z.string().optional().describe('A brief, engaging description of the drink, including its style (e.g., classic cocktail, refreshing mocktail) and flavor profile (e.g., sweet, sour, bitter).'),
    ingredients: z.array(z.string()).describe('A list of ingredients with measurements required for the beverage.'),
    instructions: z.array(z.string()).describe('Step-by-step mixing instructions.'),
    glassware: z.string().describe('The recommended glassware for serving (e.g., "Coupe glass", "Highball glass").'),
    isAlcoholic: z.boolean().describe('Whether the beverage contains alcohol.'),
    imageUrl: z.string().optional().describe('URL of an image for the beverage.'),
});
export type BeverageRecipe = z.infer<typeof BeverageRecipeSchema>;


export const GroceryItemSchema = z.object({
  name: z.string().describe('The name of the grocery item.'),
  quantity: z.string().describe('The quantity or size (e.g., "2 lbs", "1 loaf", "500g").'),
  cost: z.number().optional().describe('The estimated cost of the item in the specified currency.'),
});
export type GroceryItem = z.infer<typeof GroceryItemSchema>;

export const GroceryCategorySchema = z.object({
  name: z.string().describe('The category name (e.g., "Meat", "Dairy", "Snacks").'),
  items: z.array(GroceryItemSchema),
});

export const GroceryListOutputSchema = z.object({
    title: z.string().describe("A descriptive title for the grocery list."),
    categories: z.array(GroceryCategorySchema).describe('The grocery items, organized by category.'),
    totalCost: z.number().describe('The estimated total cost for all items.'),
    currency: z.string().describe('The currency used for cost estimation (e.g., JMD, USD).'),
});

const IngredientAnalysisSchema = z.object({
  name: z.string().describe('The name of the ingredient or additive.'),
  risk: z.enum(['Risk-Free', 'Low Risk', 'Moderate Risk', 'Hazardous']).describe('The assessed risk level of the ingredient.'),
  explanation: z.string().describe('A brief, one-sentence explanation of the ingredient and its risk.'),
});

export const ProductLabelCardSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  overallScore: z.number().describe('The final score from 0 to 100.'),
  overallRisk: z.enum(['Risk-Free', 'Low Risk', 'Moderate Risk', 'Hazardous']).describe('The overall risk category for the product.'),
  nutritionalScore: z.number().describe('The score for nutritional value, out of 60.'),
  ingredientScore: z.number().describe('The score for ingredient quality, out of 40.'),
  summary: z.string().describe('A concise summary explaining the score, pros, and cons.'),
  ingredients: z.array(IngredientAnalysisSchema).describe('A detailed breakdown of each ingredient.'),
  imageUrl: z.string().optional().describe('URL of an image for the product.'),
});
export type ProductLabelCard = z.infer<typeof ProductLabelCardSchema>;
