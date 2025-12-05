'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ScanLine, Upload, Camera, Sparkles, Bookmark, Share2, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { analyzeProductLabel, type AnalyzeProductLabelOutput, type AnalyzeProductLabelInput } from '@/ai/flows/product-label-analyzer';
import { generateProductImage } from '@/ai/flows/generate-product-image';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraView } from '@/components/camera-view';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';


const getScoreColor = (score: number) => {
  if (score <= 25) return 'bg-red-500';
  if (score <= 50) return 'bg-orange-500';
  if (score <= 75) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getRiskIndicator = (risk: 'Risk-Free' | 'Low Risk' | 'Moderate Risk' | 'Hazardous') => {
    switch (risk) {
        case 'Risk-Free': return <span className="text-green-500">🟢</span>;
        case 'Low Risk': return <span className="text-yellow-500">🟡</span>;
        case 'Moderate Risk': return <span className="text-orange-500">🟠</span>;
        case 'Hazardous': return <span className="text-red-500">🔴</span>;
    }
}

function ProductLabelPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [productName, setProductName] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalyzeProductLabelOutput | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const clearState = () => {
    setProductName('');
    setIngredientsText('');
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    setCapturedImage(null);
    if(imageInputRef.current) imageInputRef.current.value = '';
  }

  const handleAnalyze = async (input: AnalyzeProductLabelInput) => {
    if (!input.productName && !input.ingredientsText && !input.photoDataUri) {
      setError('Please provide a product name, ingredients list, or an image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeProductLabel(input);
      setAnalysisResult(result);
    } catch (e) {
      console.error(e);
      setError('Sorry, we could not analyze this product. The AI may be busy or the label could not be read.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageCapture = (imageDataUri: string) => {
    setShowCamera(false);
    clearState();
    setCapturedImage(imageDataUri);
    handleAnalyze({ photoDataUri: imageDataUri });
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      clearState();
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setCapturedImage(dataUri);
        handleAnalyze({ photoDataUri: dataUri });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSaveCard = () => {
    if (!user || !firestore || !analysisResult) return;
    
    const cardId = `product-label-${Date.now()}`;
    const cardRef = doc(firestore, 'users', user.uid, 'productLabels', cardId);

    setDocumentNonBlocking(cardRef, {
        ...analysisResult,
        id: cardId,
        savedAt: serverTimestamp(),
    }, {});

    toast({
      title: 'Product Label Saved!',
      description: `"${analysisResult.productName}" has been saved to your collection.`,
    });
  };

  const handlePostCard = async () => {
    if (!user || !firestore || !analysisResult) return;

    const postsCol = collection(firestore, 'posts');
    let content = `I analyzed "${analysisResult.productName}" and it got a score of ${analysisResult.overallScore}/100! Here's the breakdown.`;

    addDocumentNonBlocking(postsCol, {
      authorId: user.uid,
      author: { displayName: user.displayName, photoURL: user.photoURL },
      content: content,
      productLabel: analysisResult,
      isPublic: true,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    });

    toast({
      title: 'Label Posted!',
      description: 'The analysis has been shared to your feed.',
    });
  };

  const handleSendMessage = (receiverId: string) => {
    if (!user || !firestore || !analysisResult) return;
    
    const chatId = [user.uid, receiverId].sort().join('-');
    const messagesCol = collection(firestore, 'messages', chatId, 'chat');
    let messageText = `Check out this analysis for "${analysisResult.productName}". It scored ${analysisResult.overallScore}/100.`;

    addDocumentNonBlocking(messagesCol, {
        senderId: user.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        read: false,
    });
    
    toast({ title: "Message Sent!", description: `Label analysis shared.` });
    setIsMessageDialogOpen(false);
  }

  const openShareDialog = async () => {
    if (!firestore || !user) return;
    setIsMessageDialogOpen(true);
    const usersCol = collection(firestore, 'users');
    const usersSnapshot = await getDocs(usersCol);
    const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    setUsers(usersList.filter(u => u.uid !== user.uid));
  }


  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">Product Label Analyzer</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Scan a product label to get an instant analysis of its ingredients and nutritional value.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
            <Tabs defaultValue="text" onValueChange={clearState}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">From Text</TabsTrigger>
                    <TabsTrigger value="image">From Image</TabsTrigger>
                    <TabsTrigger value="camera">Use Camera</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="pt-4 space-y-4">
                    <Input
                        placeholder="Product Name (e.g., 'Choco Crunch Cereal')"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                    />
                     <Textarea
                        placeholder="List of ingredients..."
                        className="min-h-[120px] resize-none"
                        value={ingredientsText}
                        onChange={(e) => setIngredientsText(e.target.value)}
                    />
                    <Button onClick={() => handleAnalyze({ productName, ingredientsText })} className="w-full text-lg py-6" disabled={isLoading}>
                        {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Analyzing...</> : <><ScanLine className="mr-2 h-5 w-5" />Analyze Product</>}
                    </Button>
                </TabsContent>
                <TabsContent value="image" className="pt-4 text-center">
                    <CardDescription className="mb-4">Upload an image of the product, its label, or barcode.</CardDescription>
                    <Button variant="outline" onClick={() => imageInputRef.current?.click()} className="w-full text-lg py-6">
                        <Upload className="mr-2 h-5 w-5" />
                        Upload Image
                    </Button>
                </TabsContent>
                <TabsContent value="camera" className="pt-4 text-center">
                     <CardDescription className="mb-4">Use your camera to snap a picture of the label.</CardDescription>
                     <Button onClick={() => setShowCamera(true)} className="w-full text-lg py-6">
                        <Camera className="mr-2 h-5 w-5" />
                        Open Camera
                    </Button>
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageUpload} className="hidden" />
      <CameraView open={showCamera} onOpenChange={setShowCamera} onCapture={handleImageCapture} />

       {capturedImage && !isLoading && !analysisResult && (
            <div className="mt-4 pt-4 border-t">
                <h3 className="font-semibold text-lg text-center">Your Uploaded Image</h3>
                <div className="relative w-full aspect-video rounded-md overflow-hidden mt-2">
                    <Image src={capturedImage} alt="Uploaded product label" layout="fill" objectFit="contain" />
                </div>
            </div>
        )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Analysis Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
         <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing product label with AI...</p>
            </CardContent>
        </Card>
      )}
      
      {analysisResult && (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">{analysisResult.productName}</CardTitle>
                <div className="flex items-center gap-4 pt-2">
                    <div className="text-4xl font-bold">{analysisResult.overallScore}<span className="text-xl text-muted-foreground">/100</span></div>
                    <div className="flex-1">
                        <Progress value={analysisResult.overallScore} className={cn("h-4", getScoreColor(analysisResult.overallScore))} />
                        <div className="text-sm font-medium flex items-center gap-2 mt-1">
                            {getRiskIndicator(analysisResult.overallRisk)} {analysisResult.overallRisk}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 {analysisResult.imageUrl && (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                        <Image src={analysisResult.imageUrl} alt={analysisResult.productName} fill objectFit="cover" />
                    </div>
                )}

                <p className="italic text-muted-foreground">{analysisResult.summary}</p>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                    <Card className="p-3">
                        <p className="text-sm text-muted-foreground">Nutritional Value</p>
                        <p className="text-2xl font-semibold">{analysisResult.nutritionalScore}/60</p>
                    </Card>
                     <Card className="p-3">
                        <p className="text-sm text-muted-foreground">Ingredient Quality</p>
                        <p className="text-2xl font-semibold">{analysisResult.ingredientScore}/40</p>
                    </Card>
                </div>

                <div>
                    <h3 className="font-semibold text-lg mb-2">Ingredient Analysis</h3>
                    <div className="space-y-2">
                        {analysisResult.ingredients.map((item, index) => (
                            <div key={index} className="p-3 rounded-md border bg-background/50">
                                <div className="flex justify-between items-center">
                                    <p className="font-medium">{item.name}</p>
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        {getRiskIndicator(item.risk)} {item.risk}
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{item.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </CardContent>
            <CardContent className="flex flex-wrap gap-2">
                 <Button onClick={handleSaveCard} variant="outline">
                    <Bookmark className="mr-2 h-4 w-4" /> Save
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handlePostCard}>
                      <Send className="mr-2 h-4 w-4" />
                      Post to Feed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openShareDialog}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send as Message
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </CardContent>
        </Card>
      )}

      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Send Product Analysis</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
    </div>
  );
}

export default ProductLabelPage;
