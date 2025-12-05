'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { GenerateRecipesOutput } from '@/ai/flows/schemas';

interface RecipeContextType {
  recipes: GenerateRecipesOutput | null;
  setRecipes: (recipes: GenerateRecipesOutput | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

export const RecipeProvider = ({ children }: { children: ReactNode }) => {
  const [recipes, setRecipes] = useState<GenerateRecipesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <RecipeContext.Provider value={{ recipes, setRecipes, isLoading, setIsLoading }}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipeContext = () => {
  const context = useContext(RecipeContext);
  if (context === undefined) {
    throw new Error('useRecipeContext must be used within a RecipeProvider');
  }
  return context;
};
