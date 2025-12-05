
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Martini, Send, Bookmark, Camera, Upload, Play, Pause, Share2, Sparkles, MessageSquare, CalendarPlus, Edit, Check, X, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { generateBeverages, type GenerateBeveragesOutput } from '@/ai/flows/beverage-generator';
import { identifyBeverageFromImage, type IdentifyBeverageFromImageOutput } from '@/ai/flows/identify-beverage-from-image';
import { generateBeverageImage } from '@/ai/flows/generate-beverage-image';
import { textToSpeech } from '@/ai/flows/tts';
import { Textarea } from '@/components/ui/textarea';
import { CameraView } from '@/components/camera-view';
import type { BeverageRecipe as BeverageRecipeType, User } from '@/lib/types';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

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
                <span className="ml-2">{isPlaying ? 'Pause Reading' : 'Read Aloud'}</span>
            </Button>
            {audioSrc && <audio ref={audioRef} src={audioSrc} className="hidden" />}
        </div>
    );
};

const PREFERENCES = ['Non-alcoholic', 'Strong', 'Sweet', 'Sour', 'Fruity', 'Herbal', 'Spicy', 'Classic'];

export default function DrinksPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ingredients, setIngredients] = useState('');
  const [preferences, setPreferences] = useState('');
  
  const [beverages, setBeverages] = useState<GenerateBeveragesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [identificationResult, setIdentificationResult] = useState<IdentifyBeverageFromImageOutput | null>(null);

  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedBeverageForShare, setSelectedBeverageForShare] = useState<BeverageRecipeType | null>(null);
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [eventTime, setEventTime] = useState<string>('17:00');
  const [users, setUsers] = useState<User[]>([]);

  const [editingBeverageIndex, setEditingBeverageIndex] = useState<number | null>(null);


  const clearAllState = useCallback(() => {
    setIngredients('');
    setPreferences('');
    setBeverages(null);
    setError(null);
    setCapturedImage(null);
    setIdentificationResult(null);
    setIsLoading(false);
    setEditingBeverageIndex(null);
  }, []);
  
  const processImage = async (imageDataUri: string, isSingleDrink: boolean) => {
    setCapturedImage(imageDataUri);
    setIsLoading(true);

    try {
      const identification = await identifyBeverageFromImage({ photoDataUri: imageDataUri });
      setIdentificationResult(identification);

      const ingredientsToUse = identification.isPreparedDrink === isSingleDrink 
          ? identification.items 
          : identification.items;

      const beverageResult = await generateBeverages({ ingredients: ingredientsToUse });
      setBeverages(beverageResult);

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
      const result = await generateBeverages({ 
        ingredients: ingredients.split(',').map(i => i.trim()), 
        preferences: preferences.split(',').map(r => r.trim()).filter(r => r), 
      });
      setBeverages(result);
    } catch (e) {
      console.error(e);
      setError('Sorry, something went wrong while generating recipes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageCapture = (imageDataUri: string, isSingleDrink: boolean) => {
    setShowCamera(false);
    clearAllState(); 
    processImage(imageDataUri, isSingleDrink);
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isSingleDrink: boolean) => {
    const file = event.target.files?.[0];
    if (file) {
      clearAllState();
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        processImage(dataUri, isSingleDrink);
      };
      reader.readAsDataURL(file);
    }
     if(event.target) {
        event.target.value = '';
    }
  };

  const handleSaveBeverage = (beverage: BeverageRecipeType) => {
    if (!user || !firestore) return;
    
    const beverageId = `${beverage.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const beverageRef = doc(firestore, 'users', user.uid, 'savedBeverages', beverageId);

    setDocumentNonBlocking(beverageRef, { ...beverage, savedAt: serverTimestamp() }, {});

    toast({
      title: 'Drink Saved!',
      description: `"${beverage.title}" has been added to your collection.`,
    });
  };

  const handleGenerateImage = async (beverageTitle: string, index: number) => {
    setGeneratingImageFor(beverageTitle);
    try {
      const result = await generateBeverageImage({ beverageName: beverageTitle });
      if (result.imageUrl && beverages) {
        handleBeverageUpdate(index, 'imageUrl', result.imageUrl);
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Image Generation Failed',
        description: 'Could not generate an image for this beverage.',
      });
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const openShareDialog = async (beverage: BeverageRecipeType, type: 'message' | 'event') => {
    setSelectedBeverageForShare(beverage);
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

  const handlePostBeverage = async (beverage: BeverageRecipeType) => {
    if (!user || !firestore) return;

    const postsCol = collection(firestore, 'posts');
    
    addDocumentNonBlocking(postsCol, {
      authorId: user.uid,
      author: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
      content: `I'm mixing up a "${beverage.title}"! Who wants one?`,
      beverageRecipe: beverage,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    });

    toast({
      title: 'Drink Posted!',
      description: `"${beverage.title}" has been shared to your feed.`,
    });
  };

  const handleSendMessage = (receiverId: string) => {
    if (!user || !firestore || !selectedBeverageForShare) return;

    const chatId = [user.uid, receiverId].sort().join('-');
    const messagesCol = collection(firestore, 'messages', chatId, 'chat');
    
    addDocumentNonBlocking(messagesCol, {
        senderId: user.uid,
        text: `Let's make this: "${selectedBeverageForShare.title}"! Ingredients: ${selectedBeverageForShare.ingredients.join(', ')}`,
        createdAt: serverTimestamp(),
        read: false,
    });
    
    toast({
        title: "Message Sent!",
        description: `Recipe shared.`
    });
    setIsMessageDialogOpen(false);
  }

  const handleCreateEvent = () => {
    if (!user || !firestore || !selectedBeverageForShare || !eventDate) return;

    const [hours, minutes] = eventTime.split(':').map(Number);
    const finalEventDate = new Date(eventDate);
    finalEventDate.setHours(hours, minutes);

    const eventsCol = collection(firestore, 'events');
    addDocumentNonBlocking(eventsCol, {
        title: `Mixology Session: ${selectedBeverageForShare.title}`,
        description: `Let's mix some "${selectedBeverageForShare.title}" drinks!`,
        createdBy: user.uid,
        startTime: finalEventDate,
        endTime: new Date(finalEventDate.getTime() + 60 * 60 * 1000),
        location: "The Home Bar",
        participantIds: [user.uid],
        attendees: [user.uid],
        status: 'scheduled',
    });

    toast({
        title: "Event Created!",
        description: `Your mixology session for "${selectedBeverageForShare.title}" is on the calendar.`
    });
    setIsEventDialogOpen(false);
  }
  
  const handleBeverageUpdate = (beverageIndex: number, field: keyof BeverageRecipeType | `ingredients.${number}` | `instructions.${number}`, value: any) => {
    if (!beverages) return;
    const updatedBeverages = [...beverages.beverages];
    const beverageToUpdate = { ...updatedBeverages[beverageIndex] };

    if (field.startsWith('ingredients.')) {
        const ingIndex = parseInt(field.split('.')[1]);
        beverageToUpdate.ingredients[ingIndex] = value;
    } else if (field.startsWith('instructions.')) {
        const instIndex = parseInt(field.split('.')[1]);
        beverageToUpdate.instructions[instIndex] = value;
    } else {
        (beverageToUpdate as any)[field] = value;
    }

    updatedBeverages[beverageIndex] = beverageToUpdate;
    setBeverages({ beverages: updatedBeverages });
  };
  
  const handleAddItem = (beverageIndex: number, field: 'ingredients' | 'instructions') => {
      if (!beverages) return;
      const updatedBeverages = [...beverages.beverages];
      const beverageToUpdate = { ...updatedBeverages[beverageIndex] };
      beverageToUpdate[field].push('');
      updatedBeverages[beverageIndex] = beverageToUpdate;
      setBeverages({ beverages: updatedBeverages });
  };
  
  const handleRemoveItem = (beverageIndex: number, field: 'ingredients' | 'instructions', itemIndex: number) => {
    if (!beverages) return;
    const updatedBeverages = [...beverages.beverages];
    const beverageToUpdate = { ...updatedBeverages[beverageIndex] };
    beverageToUpdate[field].splice(itemIndex, 1);
    updatedBeverages[beverageIndex] = beverageToUpdate;
    setBeverages({ beverages: updatedBeverages });
  };


  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">The Bar is Open</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover cocktails and beverages you can make right now.
        </p>
      </div>

      <Tabs defaultValue="ingredients" onValueChange={clearAllState}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ingredients">With Ingredients</TabsTrigger>
          <TabsTrigger value="scan">Scan Your Bar</TabsTrigger>
          <TabsTrigger value="identify">Identify My Drink</TabsTrigger>
        </TabsList>
        <TabsContent value="ingredients">
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleGenerateFromText} className="space-y-6">
                  <div>
                    <Label htmlFor="ingredients" className="text-base font-semibold">Enter Your Ingredients & Spirits:</Label>
                    <Textarea
                      id="ingredients"
                      placeholder="e.g., gin, lime juice, tonic water, oranges"
                      className="mt-2 min-h-[120px] resize-none"
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                    />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Separate items with commas.
                    </p>
                  </div>
                <div>
                    <Label htmlFor="preferences">Preferences (Optional)</Label>
                    <Input
                        id="preferences"
                        placeholder="e.g., non-alcoholic, sweet, classic"
                        value={preferences}
                        onChange={(e) => setPreferences(e.target.value)}
                        className="mt-2"
                    />
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Mixing...</>
                  ) : (
                    <><Martini className="mr-2 h-5 w-5" />Find Drinks</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="scan">
           <Card>
            <CardHeader>
                <CardTitle>Scan Your Bar</CardTitle>
                <CardDescription>Take a picture of your bottles, mixers, and fruits. We'll tell you what cocktails you can make.</CardDescription>
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
                <CardTitle>Identify My Drink</CardTitle>
                <CardDescription>Have a picture of a finished cocktail? We'll identify it and give you the recipe.</CardDescription>
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
      
      <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handleFileUpload(e, e.currentTarget.parentElement?.querySelector('.grid-cols-3')?.querySelector('[aria-selected=true]')?.getAttribute('data-state') === 'active')} className="hidden" />
      <CameraView open={showCamera} onOpenChange={setShowCamera} onCapture={(dataUri) => handleImageCapture(dataUri, document.querySelector('.grid-cols-3')?.querySelector('[aria-selected=true]')?.getAttribute('data-state') === 'active')} />

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
                    {capturedImage ? "Analyzing image and finding drinks..." : "Generating drink recipes..."}
                </p>
            </CardContent>
        </Card>
      )}

      {identificationResult && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>{identificationResult.isPreparedDrink ? "Identified Drink" : "Identified Ingredients"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {identificationResult.items.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}


      {beverages && beverages.beverages.length > 0 && !isLoading && (
        <div className="space-y-6">
            <h2 className="text-center font-headline text-3xl font-bold">Your Drink Recipes</h2>
            {beverages.beverages.map((beverage, index) => {
                const isEditing = editingBeverageIndex === index;
                return (
                <Card key={index}>
                    <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                {isEditing ? (
                                    <Input value={beverage.title} onChange={(e) => handleBeverageUpdate(index, 'title', e.target.value)} className="text-lg font-bold" />
                                ) : (
                                    <CardTitle>{beverage.title}</CardTitle>
                                )}
                                {isEditing ? (
                                    <Textarea value={beverage.description} onChange={(e) => handleBeverageUpdate(index, 'description', e.target.value)} className="mt-1" />
                                ) : (
                                    <CardDescription>{beverage.description || `Serve in a ${beverage.glassware}`}</CardDescription>
                                )}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${beverage.isAlcoholic ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {beverage.isAlcoholic ? 'Alcoholic' : 'Non-Alcoholic'}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {generatingImageFor === beverage.title ? (
                          <Skeleton className="w-full aspect-video rounded-md" />
                        ) : beverage.imageUrl ? (
                          <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                            <Image src={beverage.imageUrl} alt={beverage.title} fill objectFit="cover" />
                          </div>
                        ) : (
                          <Button 
                            variant="outline"
                            className="w-full" 
                            onClick={() => handleGenerateImage(beverage.title, index)}
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
                                  {!isEditing && <AudioPlayer text={beverage.ingredients.join(', ')} itemKey={`ing-${index}`} />}
                                </div>
                                <AccordionContent>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            {beverage.ingredients.map((ing, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <Input value={ing} onChange={(e) => handleBeverageUpdate(index, `ingredients.${i}`, e.target.value)} />
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'ingredients', i)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => handleAddItem(index, 'ingredients')}><Plus className="mr-2 h-4 w-4" /> Add Ingredient</Button>
                                        </div>
                                    ) : (
                                        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                            {beverage.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                                        </ul>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="instructions">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <AccordionTrigger>
                                      <h3 className="font-semibold">Instructions</h3>
                                  </AccordionTrigger>
                                  {!isEditing && <AudioPlayer text={beverage.instructions.join('. ')} itemKey={`ins-${index}`} />}
                                </div>
                                <AccordionContent>
                                     {isEditing ? (
                                        <div className="space-y-2">
                                            {beverage.instructions.map((step, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <Textarea value={step} onChange={(e) => handleBeverageUpdate(index, `instructions.${i}`, e.target.value)} className="min-h-[40px]" />
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'instructions', i)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => handleAddItem(index, 'instructions')}><Plus className="mr-2 h-4 w-4" /> Add Step</Button>
                                        </div>
                                    ) : (
                                        <ol className="list-decimal space-y-2 pl-5">
                                            {beverage.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                        </ol>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        
                        <div className="flex flex-wrap gap-2 mt-4">
                            {isEditing ? (
                                <Button onClick={() => setEditingBeverageIndex(null)}>
                                    <Check className="mr-2 h-4 w-4" /> Done Editing
                                </Button>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setEditingBeverageIndex(index)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                    <Button variant="outline" onClick={() => handleSaveBeverage(beverage)}>
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
                                        <DropdownMenuItem onClick={() => handlePostBeverage(beverage)}>
                                          <Send className="mr-2 h-4 w-4" />
                                          Post to Feed
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openShareDialog(beverage, 'message')}>
                                          <MessageSquare className="mr-2 h-4 w-4" />
                                          Send as Message
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openShareDialog(beverage, 'event')}>
                                          <CalendarPlus className="mr-2 h-4 w-4" />
                                          Create Mixing Event
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
       {beverages && beverages.beverages.length === 0 && !isLoading && (
        <Alert>
          <AlertTitle>No Recipes Found</AlertTitle>
          <AlertDescription>
            We couldn't mix up any drinks with your specific ingredients and preferences. Try removing a filter or adding more ingredients.
          </AlertDescription>
        </Alert>
       )}

      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Send Drink Recipe</DialogTitle>
                <DialogDescription>Share "{selectedBeverageForShare?.title}" with a friend.</DialogDescription>
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
                  <DialogTitle>Create Mixing Event</DialogTitle>
                  <DialogDescription>Schedule a time to mix "{selectedBeverageForShare?.title}".</DialogDescription>
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
