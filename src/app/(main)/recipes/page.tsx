
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ChefHat, Send, Bookmark, Camera, Upload, Play, Pause, Share2, MessageSquare, CalendarPlus, X, Sparkles, Edit, Check, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRecipeContext } from '@/context/recipe-context';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { generateRecipes } from '@/ai/flows/recipe-generator';
import type { GenerateRecipesOutput } from '@/ai/flows/schemas';
import { identifyFromImage, type IdentifyFromImageOutput } from '@/ai/flows/identify-from-image';
import { generateForMeal } from '@/ai/flows/generate-for-meal';
import { textToSpeech } from '@/ai/flows/tts';
import { generateFoodImage } from '@/ai/flows/generate-food-image';
import { Textarea } from '@/components/ui/textarea';
import { CameraView } from '@/components/camera-view';
import type { Recipe as RecipeType, User, NutritionalInfo } from '@/lib/types';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';


// Minimal Label component to satisfy TS until I can get the full UI component
const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" {...props} />
);

const AudioPlayer = ({ text, itemKey }: { text: string, itemKey: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);

    const handlePlay = async () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            return;
        }

        if (audioSrc && audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        } else {
            setIsGenerating(true);
            try {
                const dataUri = await textToSpeech(text);
                setAudioSrc(dataUri);
            } catch (error) {
                console.error("Error generating speech", error);
            } finally {
                setIsGenerating(false);
            }
        }
    };

    useEffect(() => {
        if (audioSrc && audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [audioSrc]);
    
    useEffect(() => {
        const audioElement = audioRef.current;
        const handleEnded = () => setIsPlaying(false);
        if (audioElement) {
            audioElement.addEventListener('ended', handleEnded);
        }
        return () => {
            if (audioElement) {
                audioElement.removeEventListener('ended', handleEnded);
            }
        };
    }, [audioRef]);


    return (
        <div className="flex items-center gap-2">
            <Button onClick={handlePlay} variant="link" className="p-0 h-auto" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="ml-2">{isPlaying ? 'Pause' : 'Read Aloud'}</span>
            </Button>
            {audioSrc && <audio ref={audioRef} src={audioSrc} className="hidden" />}
        </div>
    );
};

const CUISINES = ['Italian', 'Mexican', 'Jamaican', 'French', 'Japanese', 'Chinese', 'Indian', 'Thai', 'Greek', 'Mediterranean'];

export default function RecipesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('text');

  const [ingredients, setIngredients] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  
  const { recipes, setRecipes, isLoading, setIsLoading } = useRecipeContext();
  const [error, setError] = useState<string | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const [editingRecipeIndex, setEditingRecipeIndex] = useState<number | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [identificationResult, setIdentificationResult] = useState<IdentifyFromImageOutput | null>(null);

  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedRecipeForShare, setSelectedRecipeForShare] = useState<RecipeType | null>(null);
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [eventTime, setEventTime] = useState<string>('17:00');
  
  const [users, setUsers] = useState<User[]>([]);

  const clearAllState = useCallback(() => {
    setIngredients('');
    setCuisine('');
    setDietaryRestrictions('');
    setRecipes(null);
    setError(null);
    setCapturedImage(null);
    setIdentificationResult(null);
    setIsLoading(false);
    setEditingRecipeIndex(null);
  }, [setRecipes, setIsLoading]);
  
  const processImage = async (imageDataUri: string, isSingleMeal: boolean) => {
    setCapturedImage(imageDataUri);
    setIsLoading(true);
    setIdentificationResult(null);
    setRecipes(null);

    try {
      const identification = await identifyFromImage({ photoDataUri: imageDataUri });
      setIdentificationResult(identification);

      let recipeResult: GenerateRecipesOutput;
      
      if (isSingleMeal) {
          if (identification.isMeal && identification.generatedRecipe) {
              recipeResult = { recipes: [identification.generatedRecipe] };
          } else if (identification.isMeal) {
              recipeResult = await generateForMeal({ mealName: identification.items[0] });
          } else {
              setError("We couldn't identify a single meal, but here are some ideas for the ingredients we saw.");
              recipeResult = await generateRecipes({ ingredients: identification.items });
          }
      } 
      else {
          if (!identification.isMeal) {
              recipeResult = await generateRecipes({ ingredients: identification.items });
          } else {
              setError("We identified a specific meal. Here's the recipe for it!");
              if (identification.generatedRecipe) {
                recipeResult = { recipes: [identification.generatedRecipe] };
              } else {
                recipeResult = await generateForMeal({ mealName: identification.items[0] });
              }
          }
      }
      setRecipes(recipeResult);

    } catch (e) {
      console.error(e);
      setError('Sorry, something went wrong during image analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }


  const handleGenerateFromText = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllState();
    if (ingredients.trim().length < 3) {
      setError('Please enter at least one ingredient.');
      return;
    }
    setIsLoading(true);

    try {
      const result = await generateRecipes({ 
        ingredients: ingredients.split(',').map(i => i.trim()), 
        dietaryRestrictions: dietaryRestrictions.split(',').map(r => r.trim()).filter(r => r), 
        cuisine: cuisine.trim(),
      });
      setRecipes(result);
    } catch (e) {
      console.error(e);
      setError('Sorry, something went wrong while generating recipes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageCapture = (imageDataUri: string) => {
    setShowCamera(false);
    clearAllState();
    processImage(imageDataUri, activeTab === 'identify');
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      clearAllState();
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        processImage(dataUri, activeTab === 'identify');
      };
      reader.readAsDataURL(file);
    }
     if(event.target) {
        event.target.value = '';
    }
  };


  const handlePostRecipe = async (recipe: RecipeType) => {
    if (!user || !firestore) return;

    const postsCol = collection(firestore, 'posts');
    
    addDocumentNonBlocking(postsCol, {
      authorId: user.uid,
      author: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
      content: `Check out this recipe for '${'\'\''}${recipe.title}${'\'\''}'!`,
      recipe: recipe,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    });

    toast({
      title: 'Recipe Posted!',
      description: `"${recipe.title}" has been shared to your feed.`,
    });
  };

  const handleSaveRecipe = (recipe: RecipeType) => {
    if (!user || !firestore) return;
    
    const recipeId = `${recipe.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const recipeRef = doc(firestore, 'users', user.uid, 'savedRecipes', recipeId);

    setDocumentNonBlocking(recipeRef, { ...recipe, savedAt: serverTimestamp() }, {});

    toast({
      title: 'Recipe Saved!',
      description: `"${recipe.title}" has been added to your saved recipes.`,
    });
  };

  const openShareDialog = async (recipe: RecipeType, type: 'message' | 'event') => {
    setSelectedRecipeForShare(recipe);
    if (type === 'message') {
      if (!firestore || !user) return;
      setIsMessageDialogOpen(true);
      const usersCol = collection(firestore, 'users');
      const usersSnapshot = await getDocs(usersCol);
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersList.filter(u => u.uid !== user?.uid));
    }
    if (type === 'event') setIsEventDialogOpen(true);
  };

  const handleSendMessage = (receiverId: string) => {
    if (!user || !firestore || !selectedRecipeForShare) return;
    
    const chatId = [user.uid, receiverId].sort().join('-');
    const messagesCol = collection(firestore, 'messages', chatId, 'chat');

    addDocumentNonBlocking(messagesCol, {
        senderId: user.uid,
        text: `Check out this recipe I found: "${selectedRecipeForShare.title}"! Here are the details: \n\nIngredients: ${selectedRecipeForShare.ingredients.join(', ')}\n\nInstructions: ${selectedRecipeForShare.instructions.join(' ')}`,
        createdAt: serverTimestamp(),
        read: false,
    });
    
    toast({
        title: "Message Sent!",
        description: `Recipe shared with your friend.`
    });
    setIsMessageDialogOpen(false);
  }

  const handleCreateEvent = () => {
    if (!user || !firestore || !selectedRecipeForShare || !eventDate) return;

    const [hours, minutes] = eventTime.split(':').map(Number);
    const finalEventDate = new Date(eventDate);
    finalEventDate.setHours(hours, minutes);

    const eventsCol = collection(firestore, 'events');
    addDocumentNonBlocking(eventsCol, {
        title: `Cook: ${selectedRecipeForShare.title}`,
        description: `Let's cook "${selectedRecipeForShare.title}" together!`,
        createdBy: user.uid,
        startTime: finalEventDate,
        endTime: new Date(finalEventDate.getTime() + 60 * 60 * 1000), // Assume 1 hour duration
        location: "My Kitchen",
        participantIds: [user.uid],
        attendees: [user.uid],
        status: 'scheduled',
    });

    toast({
        title: "Event Created!",
        description: `Your cooking session for "${selectedRecipeForShare.title}" is on the calendar.`
    });
    setIsEventDialogOpen(false);
  }
  
  const handleGenerateImage = async (recipeTitle: string, index: number) => {
    setGeneratingImageFor(recipeTitle);
    try {
      const result = await generateFoodImage({ dishName: recipeTitle });
      if (result.imageUrl && recipes) {
        handleRecipeUpdate(index, 'imageUrl', result.imageUrl);
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Image Generation Failed',
        description: 'Could not generate an image for this recipe.',
      });
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const handleRecipeUpdate = (recipeIndex: number, field: keyof RecipeType | `ingredients.${number}` | `instructions.${number}` | `nutritionalInfo.${keyof NutritionalInfo}` | `costInfo.${string}`, value: any) => {
    if (!recipes) return;
    const updatedRecipes = [...recipes.recipes];
    const recipeToUpdate = { ...updatedRecipes[recipeIndex] };

    if (field.startsWith('ingredients.')) {
        const ingIndex = parseInt(field.split('.')[1]);
        recipeToUpdate.ingredients[ingIndex] = value;
    } else if (field.startsWith('instructions.')) {
        const instIndex = parseInt(field.split('.')[1]);
        recipeToUpdate.instructions[instIndex] = value;
    } else if (field.startsWith('nutritionalInfo.')) {
        const nutKey = field.split('.')[1] as keyof RecipeType['nutritionalInfo'];
        if (!recipeToUpdate.nutritionalInfo) recipeToUpdate.nutritionalInfo = {};
        (recipeToUpdate.nutritionalInfo as any)[nutKey] = parseFloat(value) || 0;
    } else if (field.startsWith('costInfo.')) {
        const costKey = field.split('.')[1] as keyof RecipeType['costInfo'];
        if (!recipeToUpdate.costInfo) recipeToUpdate.costInfo = { totalCost: 0, ingredientCosts: [] };
        (recipeToUpdate.costInfo as any)[costKey] = parseFloat(value) || 0;
    }
    else {
        (recipeToUpdate as any)[field] = value;
    }

    updatedRecipes[recipeIndex] = recipeToUpdate;
    setRecipes({ recipes: updatedRecipes });
  };
  
  const handleAddItem = (recipeIndex: number, field: 'ingredients' | 'instructions') => {
      if (!recipes) return;
      const updatedRecipes = [...recipes.recipes];
      const recipeToUpdate = { ...updatedRecipes[recipeIndex] };
      recipeToUpdate[field].push('');
      updatedRecipes[recipeIndex] = recipeToUpdate;
      setRecipes({ recipes: updatedRecipes });
  };
  
  const handleRemoveItem = (recipeIndex: number, field: 'ingredients' | 'instructions', itemIndex: number) => {
    if (!recipes) return;
    const updatedRecipes = [...recipes.recipes];
    const recipeToUpdate = { ...updatedRecipes[recipeIndex] };
    recipeToUpdate[field].splice(itemIndex, 1);
    updatedRecipes[recipeIndex] = recipeToUpdate;
    setRecipes({ recipes: updatedRecipes });
  };

  const nutritionFields: { key: keyof NutritionalInfo, label: string, unit: string }[] = [
    { key: 'calories', label: 'Calories', unit: 'kcal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'totalFat', label: 'Total Fat', unit: 'g' },
    { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g' },
    { key: 'transFat', label: 'Trans Fat', unit: 'g' },
    { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
    { key: 'sodium', label: 'Sodium', unit: 'mg' },
    { key: 'totalCarbohydrates', label: 'Carbs', unit: 'g' },
    { key: 'dietaryFiber', label: 'Fiber', unit: 'g' },
    { key: 'totalSugars', label: 'Total Sugars', unit: 'g' },
    { key: 'addedSugars', label: 'Added Sugars', unit: 'g' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">What I'm Gonna Cook</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          CheapBite Recipes at your Fingertips
        </p>
      </div>

      <Tabs defaultValue="text" onValueChange={(value) => { setActiveTab(value); clearAllState(); }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="text">With Ingredients</TabsTrigger>
          <TabsTrigger value="scan">Scan My Kitchen</TabsTrigger>
          <TabsTrigger value="identify">Identify My Meal</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card>
            <CardHeader>
                <CardTitle>Generate with Text</CardTitle>
                <CardDescription>Enter the ingredients you have, and we'll suggest recipes.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateFromText} className="space-y-6">
                  <div>
                    <Label htmlFor="ingredients" className="text-base font-semibold">Enter Your Ingredients:</Label>
                    <Textarea
                      id="ingredients"
                      placeholder="e.g., chicken breast, broccoli, soy sauce, rice"
                      className="mt-2 min-h-[120px] resize-none"
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                    />
                  </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="cuisine">Cuisine Preference (Optional)</Label>
                        <Input
                            id="cuisine"
                            placeholder="e.g., Italian, Mexican, Jamaican"
                            value={cuisine}
                            onChange={(e) => setCuisine(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <div>
                        <Label htmlFor="dietary">Dietary Needs (Optional)</Label>
                        <Input
                            id="dietary"
                            placeholder="e.g., vegetarian, gluten-free, vegan"
                            value={dietaryRestrictions}
                            onChange={(e) => setDietaryRestrictions(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating...</>
                  ) : (
                    <><ChefHat className="mr-2 h-5 w-5" />Generate Recipes</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan">
           <Card>
            <CardHeader>
                <CardTitle>Scan My Kitchen</CardTitle>
                <CardDescription>Take a picture of your ingredients, and we'll figure out what you can make.</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={() => setShowCamera(true)} className="flex-1 text-lg py-6">
                        <Camera className="mr-2 h-5 w-5" />
                        Use Camera
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 text-lg py-6">
                        <Upload className="mr-2 h-5 w-5" />
                        Upload Image
                    </Button>
                 </div>
                 {capturedImage && !isLoading && (
                    <div className="mt-4 pt-4 border-t">
                        <h3 className="font-semibold text-lg">Scanned Image</h3>
                        <div className="relative w-full aspect-video rounded-md overflow-hidden mt-2">
                          <Image src={capturedImage} alt="Captured ingredients" fill objectFit="contain" />
                        </div>
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="identify">
           <Card>
            <CardHeader>
                <CardTitle>Identify My Meal</CardTitle>
                <CardDescription>Have a picture of a finished meal? We'll identify it and give you the recipe.</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={() => setShowCamera(true)} className="flex-1 text-lg py-6">
                        <Camera className="mr-2 h-5 w-5" />
                        Use Camera
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 text-lg py-6">
                        <Upload className="mr-2 h-5 w-5" />
                        Upload Image
                    </Button>
                 </div>
                 {capturedImage && !isLoading && (
                    <div className="mt-4 pt-4 border-t">
                        <h3 className="font-semibold text-lg">Scanned Image</h3>
                        <div className="relative w-full aspect-video rounded-md overflow-hidden mt-2">
                          <Image src={capturedImage} alt="Captured meal" fill objectFit="contain" />
                        </div>
                    </div>
                 )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <CameraView open={showCamera} onOpenChange={setShowCamera} onCapture={handleImageCapture} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
         <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                    {capturedImage ? "Analyzing image and finding recipes..." : "Generating recipes..."}
                </p>
            </CardContent>
        </Card>
      )}

      {identificationResult && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>{identificationResult.isMeal ? "Identified Meal" : "Identified Ingredients"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {identificationResult.items.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}


      {recipes && recipes.recipes.length > 0 && !isLoading && (
        <div className="space-y-6">
            <h2 className="text-center font-headline text-3xl font-bold">Your Recipe Ideas</h2>
            {recipes.recipes.map((recipe, index) => {
                const isEditing = editingRecipeIndex === index;
                return (
                <Card key={index}>
                    <CardHeader>
                        {isEditing ? (
                            <Input value={recipe.title} onChange={(e) => handleRecipeUpdate(index, 'title', e.target.value)} className="text-2xl font-semibold" />
                        ) : (
                            <CardTitle>{recipe.title}</CardTitle>
                        )}
                        {isEditing ? (
                            <Textarea value={recipe.description} onChange={(e) => handleRecipeUpdate(index, 'description', e.target.value)} className="mt-1" />
                        ) : (
                             <CardDescription>{recipe.description || `Serving Size: ${recipe.servingSize}`}</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {generatingImageFor === recipe.title ? (
                          <Skeleton className="w-full aspect-video rounded-md" />
                        ) : recipe.imageUrl ? (
                          <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                            <Image src={recipe.imageUrl} alt={recipe.title} fill objectFit="cover" />
                          </div>
                        ) : (
                          <Button 
                            variant="outline"
                            className="w-full" 
                            onClick={() => handleGenerateImage(recipe.title, index)}
                            disabled={!!generatingImageFor}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Image
                          </Button>
                        )}
                        <Accordion type="single" collapsible className="w-full" defaultValue={isEditing ? 'ingredients' : undefined}>
                            <AccordionItem value="ingredients">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <AccordionTrigger>
                                      <h3 className="font-semibold">Ingredients</h3>
                                  </AccordionTrigger>
                                  {!isEditing && <AudioPlayer text={recipe.ingredients.join(', ')} itemKey={`ing-${index}`} />}
                                </div>
                                <AccordionContent>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            {recipe.ingredients.map((ing, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <Input value={ing} onChange={(e) => handleRecipeUpdate(index, `ingredients.${i}`, e.target.value)} />
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'ingredients', i)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => handleAddItem(index, 'ingredients')}><Plus className="mr-2 h-4 w-4" /> Add Ingredient</Button>
                                        </div>
                                    ) : (
                                        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                            {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                                        </ul>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="instructions">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <AccordionTrigger>
                                      <h3 className="font-semibold">Instructions</h3>
                                  </AccordionTrigger>
                                  {!isEditing && <AudioPlayer text={recipe.instructions.join('. ')} itemKey={`ins-${index}`} />}
                                </div>
                                <AccordionContent>
                                     {isEditing ? (
                                        <div className="space-y-2">
                                            {recipe.instructions.map((step, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <Textarea value={step} onChange={(e) => handleRecipeUpdate(index, `instructions.${i}`, e.target.value)} className="min-h-[40px]" />
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'instructions', i)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => handleAddItem(index, 'instructions')}><Plus className="mr-2 h-4 w-4" /> Add Step</Button>
                                        </div>
                                    ) : (
                                        <ol className="list-decimal space-y-2 pl-5">
                                            {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                        </ol>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="nutrition">
                                <AccordionTrigger>
                                    <h3 className="font-semibold">Nutritional Information</h3>
                                </AccordionTrigger>
                                <AccordionContent>
                                    {isEditing ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                            {nutritionFields.map(field => (
                                                <div key={field.key} className="flex flex-col gap-1">
                                                    <Label htmlFor={`${field.key}-${index}`} className="text-xs">{field.label}</Label>
                                                    <div className="flex items-center gap-1">
                                                        <Input id={`${field.key}-${index}`} type="number" value={recipe.nutritionalInfo?.[field.key] || ''} onChange={(e) => handleRecipeUpdate(index, `nutritionalInfo.${field.key}`, e.target.value)} className="w-20 h-7 text-xs" />
                                                        <span className="text-muted-foreground">{field.unit}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : recipe.nutritionalInfo ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                                            {nutritionFields.map(field => (
                                                (recipe.nutritionalInfo as any)[field.key] !== undefined && (
                                                <div key={field.key}>
                                                    <span className="font-medium">{(recipe.nutritionalInfo as any)[field.key]}</span>
                                                    <span className="text-muted-foreground">{field.unit}</span>
                                                    <span className="ml-1">{field.label}</span>
                                                </div>
                                                )
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">No nutritional information available.</p>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="flex flex-wrap gap-2 mt-4">
                             {isEditing ? (
                                <Button onClick={() => setEditingRecipeIndex(null)}>
                                    <Check className="mr-2 h-4 w-4" /> Done Editing
                                </Button>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setEditingRecipeIndex(index)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                    <Button variant="outline" onClick={() => handleSaveRecipe(recipe)}>
                                        <Bookmark className="mr-2 h-4 w-4" />
                                        Save
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button>
                                          <Share2 className="mr-2 h-4 w-4" />
                                          Share
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handlePostRecipe(recipe)}>
                                          <Send className="mr-2 h-4 w-4" />
                                          Post to Feed
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openShareDialog(recipe, 'message')}>
                                          <MessageSquare className="mr-2 h-4 w-4" />
                                          Send as Message
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openShareDialog(recipe, 'event')}>
                                          <CalendarPlus className="mr-2 h-4 w-4" />
                                          Create Cooking Event
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )})}
        </div>
      )}
       {recipes && recipes.recipes.length === 0 && !isLoading && (
        <Alert>
          <AlertTitle>No Recipes Found</AlertTitle>
          <AlertDescription>
            We couldn't find any recipes with your specific ingredients and filters. Try removing a filter or adding more ingredients.
          </AlertDescription>
        </Alert>
       )}

      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Send Recipe as Message</DialogTitle>
                <DialogDescription>Share "{selectedRecipeForShare?.title}" with a friend.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <p>Who do you want to send this to?</p>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {users.map(u => (
                        <Button key={u.uid} variant="outline" className="w-full justify-start" onClick={() => u.uid && handleSendMessage(u.uid)}>
                            {u.displayName}
                        </Button>
                    ))}
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Create Cooking Event</DialogTitle>
                  <DialogDescription>Schedule a time to cook "{selectedRecipeForShare?.title}" with friends.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="grid grid-cols-2 gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !eventDate && "text-muted-foreground"
                            )}
                            >
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                            mode="single"
                            selected={eventDate}
                            onSelect={setEventDate}
                            initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <Input
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                    />
                 </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setIsEventDialogOpen(false)} variant="ghost">Cancel</Button>
                  <Button onClick={handleCreateEvent}>Create Event</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </div>
  );
}
