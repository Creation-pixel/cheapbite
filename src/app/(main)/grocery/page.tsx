
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, List, Sparkles, Edit, Check, X, Plus, Trash2, Map, Bookmark, Share2, Send, MessageSquare, Camera, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { processGroceryList } from '@/ai/flows/grocery-list-processor';
import type { ProcessGroceryListOutput, ProcessGroceryListInput } from '@/ai/flows/grocery-list-processor';
import type { GroceryItem } from '@/ai/flows/schemas';
import { getNearbyStores } from '@/ai/tools/location';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { User, GroceryList as GroceryListType } from '@/lib/types';
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraView } from '@/components/camera-view';
import Image from 'next/image';

function GroceryListPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [rawList, setRawList] = useState('');
  const [location, setLocation] = useState('');
  const [processedList, setProcessedList] = useState<ProcessGroceryListOutput | null>(null);
  const [suggestedStores, setSuggestedStores] = useState<string[] | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearState = () => {
    setRawList('');
    // keep location
    setProcessedList(null);
    setSuggestedStores(null);
    setError(null);
    setIsLoading(false);
    setCapturedImage(null);
    if(imageInputRef.current) imageInputRef.current.value = '';
    if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleGenerateList = async (input: ProcessGroceryListInput) => {
    if (!input.list && !input.photoDataUri) {
      setError('Please enter a grocery list or upload an image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setProcessedList(null);
    setSuggestedStores(null);

    try {
      const result = await processGroceryList(input);
      setProcessedList(result);
    } catch (e) {
      console.error(e);
      setError('Sorry, something went wrong while processing your list. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageCapture = (imageDataUri: string) => {
    setShowCamera(false);
    setCapturedImage(imageDataUri);
    handleGenerateList({ photoDataUri: imageDataUri, region: location });
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      clearState();
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setCapturedImage(dataUri);
        handleGenerateList({ photoDataUri: dataUri, region: location });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      clearState();
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        await handleGenerateList({ list: text, region: location });
      };
      reader.readAsText(file);
    }
  };
  
  const handleSuggestStores = async () => {
    setIsLoading(true);
    try {
        const stores = await getNearbyStores({});
        setSuggestedStores(stores);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch nearby stores.' });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleUpdateItem = (categoryIndex: number, itemIndex: number, field: keyof GroceryItem, value: string | number) => {
    if (!processedList) return;
    const newList = { ...processedList };
    (newList.categories[categoryIndex].items[itemIndex] as any)[field] = value;
    
    // Recalculate total
    newList.totalCost = newList.categories.reduce((total, category) => {
        return total + category.items.reduce((catTotal, item) => catTotal + (item.cost || 0), 0);
    }, 0);

    setProcessedList(newList);
  };
  
  const handleRemoveItem = (categoryIndex: number, itemIndex: number) => {
    if (!processedList) return;
    const newList = { ...processedList };
    newList.categories[categoryIndex].items.splice(itemIndex, 1);
    
    // Recalculate total
    newList.totalCost = newList.categories.reduce((total, category) => {
        return total + category.items.reduce((catTotal, item) => catTotal + (item.cost || 0), 0);
    }, 0);

    setProcessedList(newList);
  };
  
  const handleSaveList = () => {
    if (!user || !firestore || !processedList) return;
    
    const listId = `grocery-list-${Date.now()}`;
    const listRef = doc(firestore, 'users', user.uid, 'groceryLists', listId);

    const listToSave: GroceryListType = {
        id: listId,
        title: processedList.title || `Grocery List from ${new Date().toLocaleDateString()}`,
        categories: processedList.categories,
        totalCost: processedList.totalCost,
        currency: processedList.currency,
        savedAt: serverTimestamp() as any,
    };

    setDocumentNonBlocking(listRef, listToSave, {});

    toast({
      title: 'Grocery List Saved!',
      description: `Your list has been saved to your profile.`,
    });
  };

  const handlePostList = async () => {
    if (!user || !firestore || !processedList) return;

    const postsCol = collection(firestore, 'posts');
    
    let content = `My grocery list: ${processedList.title}\n`;
    processedList.categories.forEach(cat => {
        content += `\n**${cat.name}**\n`;
        cat.items.forEach(item => {
            content += `- ${item.name} (${item.quantity})\n`;
        });
    });
    content += `\n**Total: ~${processedList.currency} ${processedList.totalCost.toFixed(2)}**`;

    addDocumentNonBlocking(postsCol, {
      authorId: user.uid,
      author: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
      content: content,
      isPublic: true,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    });

    toast({
      title: 'List Posted!',
      description: `Your grocery list has been shared to your feed.`,
    });
  };

  const handleSendMessage = (receiverId: string) => {
    if (!user || !firestore || !processedList) return;
    
    const chatId = [user.uid, receiverId].sort().join('-');
    const messagesCol = collection(firestore, 'messages', chatId, 'chat');

    let messageText = `Here's my grocery list: "${processedList.title}"! Total is about ${processedList.currency} ${processedList.totalCost.toFixed(2)}.`;

    addDocumentNonBlocking(messagesCol, {
        senderId: user.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        read: false,
    });
    
    toast({ title: "Message Sent!", description: `List shared.` });
    setIsMessageDialogOpen(false);
  }

  useEffect(() => {
    const fetchUsers = async () => {
      if (!firestore) return;
      const usersCol = collection(firestore, 'users');
      const usersSnapshot = await getDocs(usersCol);
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersList.filter(u => u.uid !== user?.uid));
    };

    if (isMessageDialogOpen) {
      fetchUsers();
    }
  }, [isMessageDialogOpen, firestore, user]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">Grocery List Helper</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Create a smart shopping list from a receipt, a recipe, text, an image, or a file.
        </p>
      </div>

      <Card>
        <CardHeader>
             <label htmlFor="location" className="text-sm font-medium">Your Location (optional for better pricing)</label>
            <Input
                id="location"
                placeholder="e.g., Kingston, Jamaica or Miami, FL"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
            />
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="text" onValueChange={clearState}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">From Text</TabsTrigger>
                    <TabsTrigger value="image">From Image</TabsTrigger>
                    <TabsTrigger value="file">From File</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="pt-4">
                     <Textarea
                        id="grocery-list"
                        placeholder="e.g., 2 lbs chicken, 1 loaf of bread, milk..."
                        className="mt-2 min-h-[150px] resize-none"
                        value={rawList}
                        onChange={(e) => setRawList(e.target.value)}
                    />
                    <Button onClick={() => handleGenerateList({ list: rawList, region: location })} className="w-full text-lg py-6 mt-4" disabled={isLoading || !rawList.trim()}>
                        {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing...</> : <><Sparkles className="mr-2 h-5 w-5" />Generate Smart List</>}
                    </Button>
                </TabsContent>
                <TabsContent value="image" className="pt-4">
                    <CardDescription className="text-center mb-4">Take a picture of a receipt or a handwritten list.</CardDescription>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={() => setShowCamera(true)} className="flex-1 text-lg py-6">
                            <Camera className="mr-2 h-5 w-5" />
                            Use Camera
                        </Button>
                        <Button variant="outline" onClick={() => imageInputRef.current?.click()} className="flex-1 text-lg py-6">
                            <Upload className="mr-2 h-5 w-5" />
                            Upload Image
                        </Button>
                    </div>
                </TabsContent>
                <TabsContent value="file" className="pt-4">
                    <CardDescription className="text-center mb-4">Upload a text file, PDF, or Word document.</CardDescription>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full text-lg py-6">
                        <Upload className="mr-2 h-5 w-5" />
                        Upload File
                    </Button>
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageUpload} className="hidden" />
      <input type="file" accept=".txt,.pdf,.doc,.docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <CameraView open={showCamera} onOpenChange={setShowCamera} onCapture={handleImageCapture} />

       {capturedImage && !isLoading && (
            <div className="mt-4 pt-4 border-t">
                <h3 className="font-semibold text-lg text-center">Your Uploaded Image</h3>
                <div className="relative w-full aspect-video rounded-md overflow-hidden mt-2">
                    <Image src={capturedImage} alt="Uploaded list" layout="fill" objectFit="contain" />
                </div>
            </div>
        )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && !processedList && (
         <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Generating your categorized list...</p>
            </CardContent>
        </Card>
      )}
      
      {processedList && (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{processedList.title || 'Your Grocery List'}</CardTitle>
                    <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? 'default' : 'outline'}>
                        {isEditing ? <Check className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                        {isEditing ? 'Done' : 'Edit'}
                    </Button>
                </div>
                <CardDescription>
                    Estimated Total Cost: <span className="font-bold">{processedList.currency} ${processedList.totalCost.toFixed(2)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {processedList.categories.map((category, catIndex) => (
                    <div key={catIndex}>
                        <h3 className="font-semibold text-lg border-b pb-1 mb-2">{category.name}</h3>
                        <div className="space-y-2">
                            {category.items.map((item, itemIndex) => (
                                <div key={itemIndex} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
                                    {isEditing ? (
                                        <>
                                            <Input value={item.name} onChange={(e) => handleUpdateItem(catIndex, itemIndex, 'name', e.target.value)} />
                                            <Input value={item.quantity} className="w-24" onChange={(e) => handleUpdateItem(catIndex, itemIndex, 'quantity', e.target.value)} />
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">{processedList.currency}</span>
                                                <Input type="number" value={item.cost || 0} className="w-20 h-9" onChange={(e) => handleUpdateItem(catIndex, itemIndex, 'cost', parseFloat(e.target.value))} />
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveItem(catIndex, itemIndex)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span>{item.name}</span>
                                            <span className="text-muted-foreground">{item.quantity}</span>
                                            <span className="font-medium text-right">{processedList.currency} {item.cost?.toFixed(2) || 'N/A'}</span>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                <div className="flex flex-wrap gap-2 mt-6">
                    <Button onClick={handleSuggestStores} variant="outline" disabled={isLoading}>
                        <Map className="mr-2 h-4 w-4" /> Suggest Nearby Stores
                    </Button>
                     <Button onClick={handleSaveList} variant="outline">
                        <Bookmark className="mr-2 h-4 w-4" /> Save List
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handlePostList}>
                          <Send className="mr-2 h-4 w-4" />
                          Post to Feed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsMessageDialogOpen(true)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Send as Message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                
                {suggestedStores && (
                    <div className="pt-4 mt-4 border-t">
                        <h4 className="font-semibold mb-2">Suggested Stores:</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                            {suggestedStores.map((store, i) => <li key={i}>{store}</li>)}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Send Grocery List</DialogTitle>
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

export default GroceryListPage;
