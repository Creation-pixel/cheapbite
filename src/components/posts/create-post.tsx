'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, Send, Loader2, X, ChefHat, Camera, Upload, MapPin, ShoppingCart, Video, Link as LinkIcon, Tags, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy } from 'firebase/firestore';
import Image from 'next/image';
import type { Recipe, SavedRecipe, GroceryList, SavedGroceryList, Post, PublicUserProfile } from '@/lib/types';
import { useCollection, useMemoFirebase } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CameraView } from '@/components/camera-view';
import { getInitials } from '@/lib/utils';
import { DialogTrigger } from '@radix-ui/react-dialog';
import { dataUrlToBlob } from '@/lib/data-utils';
import { Progress } from '@/components/ui/progress';
import { analyzePostImage } from '@/ai/flows/analyze-post-image';
import type { AnalyzePostImageOutput } from '@/ai/flows/analyze-post-image';
import { Badge } from '../ui/badge';
import { createPostWithImage } from '@/lib/actions';


export function CreatePost() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [attachedRecipe, setAttachedRecipe] = useState<Recipe | null>(null);
  const [attachedGroceryList, setAttachedGroceryList] = useState<GroceryList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [isGroceryListDialogOpen, setIsGroceryListDialogOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzePostImageOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisControllerRef = useRef<AbortController | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  const savedRecipesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'savedRecipes'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);
  const { data: savedRecipes } = useCollection<SavedRecipe>(savedRecipesQuery);
  
  const savedGroceryListsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'groceryLists'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);
  const { data: savedGroceryLists } = useCollection<SavedGroceryList>(savedGroceryListsQuery);


  const handleCancelAnalysis = useCallback(() => {
    if (analysisControllerRef.current) {
      analysisControllerRef.current.abort();
    }
    setIsAnalyzing(false);
    setAnalysisResult(null);
  }, []);

  const resetState = useCallback(() => {
    setContent('');
    setLocation('');
    setTags('');
    setImageUri(null);
    setImageFile(null);
    setAttachedRecipe(null);
    setAttachedGroceryList(null);
    setExternalVideoUrl('');
    setIsLoading(false);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    if (analysisControllerRef.current) {
        analysisControllerRef.current.abort();
    }
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }, []);

  const handleImageChange = useCallback((dataUri: string, file?: File) => {
    setImageUri(dataUri);
    if (file) setImageFile(file);
    setIsAnalyzing(true);
    setAnalysisResult(null);

    if (analysisControllerRef.current) {
        analysisControllerRef.current.abort();
    }
    analysisControllerRef.current = new AbortController();
    const signal = analysisControllerRef.current.signal;

    analyzePostImage({ photoDataUri: dataUri })
      .then(result => {
        if (signal.aborted) return;
        setAnalysisResult(result);
        if (!content) {
            setContent(`${result.title}\n\n${result.description}`);
        }
      })
      .catch(e => {
        if (signal.aborted) return;
        console.error("Image analysis failed", e);
        toast({ variant: 'destructive', title: 'AI Analysis Failed', description: 'Could not analyze the image.' });
      })
      .finally(() => {
        if (!signal.aborted) {
            setIsAnalyzing(false);
        }
      });
  }, [toast, content]);

  const handleImageSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            handleImageChange(reader.result, file);
        }
    };
  }, [handleImageChange]);
  
  const handleImageCapture = useCallback(async (imageDataUri: string) => {
    setShowCamera(false);
    const blob = await dataUrlToBlob(imageDataUri);
    const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
    handleImageChange(imageDataUri, file);
  }, [handleImageChange]);
  
  const handleSelectRecipe = (recipe: SavedRecipe) => {
    setAttachedRecipe(recipe);
    setAttachedGroceryList(null);
    setIsRecipeDialogOpen(false);
    toast({
        title: `Attached "${recipe.title}"`,
        description: "The recipe will be included in your post."
    })
  }

  const handleSelectGroceryList = (list: SavedGroceryList) => {
    setAttachedGroceryList(list);
    setAttachedRecipe(null);
    setIsGroceryListDialogOpen(false);
    toast({
        title: `Attached "${list.title}"`,
        description: "The grocery list will be included in your post."
    })
  }

  const handlePost = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to post.' });
      return;
    }
    if (!content.trim() && !imageUri && !attachedRecipe && !attachedGroceryList) {
      toast({ variant: 'destructive', title: 'Empty Post', description: 'Please add some content to your post.' });
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append('content', content);
    formData.append('authorId', user.uid);
    
    // Append optional fields
    if (location.trim()) formData.append('location', location.trim());
    if (tags.trim()) formData.append('tags', tags.trim());
    if (externalVideoUrl.trim()) formData.append('externalVideoUrl', externalVideoUrl.trim());
    if (imageFile) formData.append('image', imageFile);
    if (attachedRecipe) formData.append('recipe', JSON.stringify(attachedRecipe));
    if (attachedGroceryList) formData.append('groceryList', JSON.stringify(attachedGroceryList));
    
    try {
      const result = await createPostWithImage(formData);
      
      if (result.success) {
        toast({ title: "Post Submitted!", description: "Your post is now live." });
        resetState();
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }

    } catch (e: any) {
      console.error("Post creation failed", e);
      toast({ 
        variant: 'destructive', 
        title: 'Post Failed', 
        description: e.message || 'Could not create your post. Please try again.' 
      });
    } finally {
        setIsLoading(false);
    }
  };
  
  return (
    <>
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="hidden sm:block">
            <AvatarImage src={user?.photoURL ?? ''} alt={user?.displayName ?? ''} />
            <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
          </Avatar>
          <div className="w-full space-y-2">
            <Textarea
              placeholder="Share a meal, a recipe, or your latest food adventure..."
              className="min-h-[80px] w-full resize-none border-0 p-0 shadow-none focus-visible:ring-0"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isLoading}
            />
             <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Add a location (e.g., 'Joe's Pizza')"
                    className="pl-8"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={isLoading}
                />
            </div>
             <div className="relative">
                <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Add a video link (e.g., YouTube, TikTok)"
                    className="pl-8"
                    value={externalVideoUrl}
                    onChange={(e) => setExternalVideoUrl(e.target.value)}
                    disabled={isLoading}
                />
            </div>
            <div className="relative">
                <Tags className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Add tags, separated by commas (e.g., #vegan, #mealprep)"
                    className="pl-8"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    disabled={isLoading}
                />
            </div>
          </div>
        </div>
        
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelection} className="hidden" />
        <CameraView open={showCamera} onOpenChange={setShowCamera} onCapture={handleImageCapture} />

        {isAnalyzing && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is analyzing your image...</span>
                <Button variant="ghost" size="sm" onClick={handleCancelAnalysis}>Cancel</Button>
            </div>
        )}

        {imageUri && (
             <div className="relative group">
                <Image src={imageUri} alt="Post preview" width={500} height={300} className="rounded-lg object-cover w-full" />
                {!isLoading && <Button variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => {
                    setImageUri(null);
                    setImageFile(null);
                    setAnalysisResult(null);
                    if (analysisControllerRef.current) analysisControllerRef.current.abort();
                    setIsAnalyzing(false);
                    if(fileInputRef.current) fileInputRef.current.value = '';
                }}>
                    <X className="h-4 w-4" />
                </Button>}
                 {analysisResult && !isAnalyzing && (
                    <Badge variant="secondary" className="absolute bottom-2 left-2">
                        <Wand2 className="h-3 w-3 mr-1.5"/>
                        AI suggestion: {analysisResult.category}
                    </Badge>
                )}
            </div>
        )}

        {attachedRecipe && (
            <Card className="bg-muted/50 relative group">
                <CardContent className="p-3">
                  <p className="text-sm font-semibold">Attached Recipe: {attachedRecipe.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{attachedRecipe.ingredients.join(", ")}</p>
                </CardContent>
                 {!isLoading && <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setAttachedRecipe(null)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                </Button>}
            </Card>
        )}
        
        {attachedGroceryList && (
            <Card className="bg-muted/50 relative group">
                <CardContent className="p-3">
                  <p className="text-sm font-semibold">Attached List: {attachedGroceryList.title}</p>
                  <p className="text-xs text-muted-foreground">Total: {attachedGroceryList.currency} ${attachedGroceryList.totalCost.toFixed(2)}</p>
                </CardContent>
                 {!isLoading && <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setAttachedGroceryList(null)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                </Button>}
            </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
                 <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Image
                 </Button>
                 <Button variant="outline" size="sm" onClick={() => setShowCamera(true)} disabled={isLoading}>
                    <Camera className="h-4 w-4 mr-2" />
                    Camera
                 </Button>
                <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isLoading}>
                            <ChefHat className="h-4 w-4 mr-2" />
                            Recipe
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Attach a Saved Recipe</DialogTitle>
                            <DialogDescription>Select one of your saved recipes to include in the post.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                            <div className="space-y-2 py-4">
                                {savedRecipes && savedRecipes.length > 0 ? savedRecipes.map(recipe => (
                                    <Card key={recipe.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleSelectRecipe(recipe)}>
                                        <CardContent className="p-3">
                                            <p className="font-semibold">{recipe.title}</p>
                                            <p className="text-sm text-muted-foreground line-clamp-1">{recipe.ingredients.join(', ')}</p>
                                        </CardContent>
                                    </Card>
                                )) : <p className="text-sm text-muted-foreground text-center">You have no saved recipes.</p>}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
                 <Dialog open={isGroceryListDialogOpen} onOpenChange={setIsGroceryListDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isLoading}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            List
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Attach a Saved Grocery List</DialogTitle>
                            <DialogDescription>Select one of your saved lists to include in the post.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                            <div className="space-y-2 py-4">
                                {savedGroceryLists && savedGroceryLists.length > 0 ? savedGroceryLists.map(list => (
                                    <Card key={list.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleSelectGroceryList(list)}>
                                        <CardContent className="p-3">
                                            <p className="font-semibold">{list.title}</p>
                                            <p className="text-sm text-muted-foreground">Total: {list.currency} ${list.totalCost.toFixed(2)}</p>
                                        </CardContent>
                                    </Card>
                                )) : <p className="text-sm text-muted-foreground text-center">You have no saved grocery lists.</p>}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex items-center gap-2">
               {isAnalyzing && (
                    <Button variant="secondary" size="sm" onClick={handleCancelAnalysis}>
                        <X className="h-4 w-4 mr-2"/>
                        Cancel AI
                    </Button>
                )}
                <Button onClick={handlePost} disabled={isLoading || isAnalyzing}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Post
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
