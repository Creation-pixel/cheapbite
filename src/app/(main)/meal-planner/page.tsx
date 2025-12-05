
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { SavedRecipe, MealPlan, Recipe } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DndContext, useDraggable, useDroppable, closestCorners } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { GripVertical, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
type MealType = typeof MEAL_TYPES[number];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = typeof DAYS[number];

function RecipeItem({ recipe }: { recipe: SavedRecipe }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipe },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <Card ref={setNodeRef} style={style} className="mb-2 p-2 touch-none">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="cursor-grab" {...listeners} {...attributes}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex-1">
            <p className="font-semibold text-sm">{recipe.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{recipe.ingredients.join(', ')}</p>
        </div>
      </div>
    </Card>
  );
}

function MealSlot({ day, mealType, recipe, onSlotClick, onClear }: { day: Day, mealType: MealType, recipe: Recipe | null, onSlotClick: () => void, onClear: () => void }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${day}-${mealType}`,
    data: { day, mealType },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={!recipe ? onSlotClick : undefined}
      className={cn(
        "h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-center p-2 transition-colors relative",
        isOver ? "border-primary bg-primary/10" : "border-border",
        recipe && "border-solid border-border bg-card",
        !recipe && "cursor-pointer hover:bg-muted/50"
      )}
    >
      {recipe ? (
        <div className="w-full">
            <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={onClear}>
                <X className="h-3 w-3" />
            </Button>
            <p className="font-bold text-sm pr-4">{recipe.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 pr-4">{recipe.instructions.join(' ')}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Drop or click to add</p>
      )}
    </div>
  );
}

function DayColumn({ day, meals, onSlotClick, onClearSlot }: { day: Day, meals: Record<MealType, Recipe | null>, onSlotClick: (day: Day, mealType: MealType) => void, onClearSlot: (day: Day, mealType: MealType) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-center font-bold capitalize">{day}</h3>
      <div className="space-y-2">
        {MEAL_TYPES.map(mealType => (
          <div key={mealType}>
            <p className="text-sm font-semibold capitalize text-muted-foreground mb-1">{mealType}</p>
            <MealSlot day={day} mealType={mealType} recipe={meals[mealType]} onSlotClick={() => onSlotClick(day, mealType)} onClear={() => onClearSlot(day, mealType)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MealPlannerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{day: Day, mealType: MealType} | null>(null);

  const savedRecipesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'savedRecipes'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);

  const { data: savedRecipes, isLoading: isLoadingRecipes } = useCollection<SavedRecipe>(savedRecipesQuery);

  const mealPlanRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'mealPlan', 'currentWeek');
  }, [user, firestore]);

  useEffect(() => {
    const fetchMealPlan = async () => {
      if (!mealPlanRef) return;
      const docSnap = await getDoc(mealPlanRef);
      if (docSnap.exists()) {
        setMealPlan(docSnap.data() as MealPlan);
      } else {
        const emptyPlan: MealPlan = { week: {} };
        DAYS.forEach(day => {
            emptyPlan.week[day] = { breakfast: null, lunch: null, dinner: null };
        });
        setMealPlan(emptyPlan);
      }
    };
    fetchMealPlan();
  }, [mealPlanRef]);
  
  const updateMealPlan = async (day: Day, mealType: MealType, recipe: Recipe | null) => {
    const newMealPlan = { ...mealPlan };
    if (!newMealPlan.week) newMealPlan.week = {};
    if (!newMealPlan.week[day]) newMealPlan.week[day] = { breakfast: null, lunch: null, dinner: null };

    newMealPlan.week[day]![mealType] = recipe;

    setMealPlan(newMealPlan as MealPlan);

    if (mealPlanRef) {
        try {
            await setDoc(mealPlanRef, newMealPlan, { merge: true });
            toast({
                title: recipe ? "Meal Plan Updated" : "Meal Slot Cleared",
                description: recipe ? `Added "${recipe.title}" to ${day}'s ${mealType}.` : `${day}'s ${mealType} has been cleared.`
            });
        } catch (error) {
            console.error("Error saving meal plan:", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Could not save your meal plan."
            })
        }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (!over) return;

    const recipe = active.data.current?.recipe as Recipe | undefined;
    const day = over.data.current?.day as Day | undefined;
    const mealType = over.data.current?.mealType as MealType | undefined;

    if (!recipe || !day || !mealType) return;
    
    updateMealPlan(day, mealType, recipe);
  };

  const handleSlotClick = (day: Day, mealType: MealType) => {
    setSelectedSlot({ day, mealType });
    setIsRecipeDialogOpen(true);
  };

  const handleRecipeSelect = (recipe: SavedRecipe) => {
    if (selectedSlot) {
      updateMealPlan(selectedSlot.day, selectedSlot.mealType, recipe);
    }
    setIsRecipeDialogOpen(false);
    setSelectedSlot(null);
  }
  
  const handleClearSlot = (day: Day, mealType: MealType) => {
    updateMealPlan(day, mealType, null);
  }

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col">
        <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg mb-8">Meal Planner</h1>
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 flex-1 overflow-hidden">
          <div className="flex flex-col border-r pr-4">
            <h2 className="text-xl font-semibold mb-4">Your Saved Recipes</h2>
            <div className="flex-1 overflow-y-auto">
              {isLoadingRecipes && (
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
              )}
              {savedRecipes && savedRecipes.map(recipe => (
                <RecipeItem key={recipe.id} recipe={recipe} />
              ))}
               {!isLoadingRecipes && savedRecipes?.length === 0 && (
                 <div className="text-center text-muted-foreground p-4 border-dashed border-2 rounded-lg">
                    <p>You have no saved recipes.</p>
                    <p className="text-xs">Go to the Recipes page to find and save some!</p>
                 </div>
               )}
            </div>
          </div>
          <div className="overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                {DAYS.map(day => (
                    <DayColumn 
                        key={day} 
                        day={day} 
                        meals={mealPlan?.week?.[day] || { breakfast: null, lunch: null, dinner: null}} 
                        onSlotClick={handleSlotClick}
                        onClearSlot={handleClearSlot}
                    />
                ))}
            </div>
          </div>
        </div>
      </div>
       <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Select a Recipe</DialogTitle>
                <DialogDescription>
                    Choose a saved recipe to add to {selectedSlot?.day}'s {selectedSlot?.mealType}.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                 <div className="space-y-2 py-4">
                    {savedRecipes && savedRecipes.map(recipe => (
                        <Card key={recipe.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleRecipeSelect(recipe)}>
                            <CardContent className="p-3">
                                <p className="font-semibold">{recipe.title}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1">{recipe.ingredients.join(', ')}</p>
                            </CardContent>
                        </Card>
                    ))}
                 </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
    