
'use client';

import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { type SavedRecipe, type Recipe, type User, type SavedBeverage, type BeverageRecipe, type SavedGroceryList, type SavedProductLabel, type ProductLabelCard } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Trash2, Share2, Send, MessageSquare, CalendarPlus, Play, Pause, Sparkles, ChefHat, Martini, ShoppingCart, ScanLine } from 'lucide-react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { generateFoodImage } from '@/ai/flows/generate-food-image';
import { generateBeverageImage } from '@/ai/flows/generate-beverage-image';
import { generateProductImage } from '@/ai/flows/generate-product-image';
import { textToSpeech } from '@/ai/flows/tts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';


function ListSkeleton() {
    return (
        <div className="space-y-4 pt-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    )
}

function EmptyState({ itemType }: { itemType: string }) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/50 p-12 text-center mt-6">
          <h3 className="text-xl font-semibold">No Saved {itemType}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You haven't saved any {itemType.toLowerCase()} yet. Start exploring and save your favorites!
          </p>
      </div>
    );
}


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
        if (audioElement) audioElement.addEventListener('ended', handleEnded);
        return () => {
            if (audioElement) audioElement.removeEventListener('ended', handleEnded);
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


function SavedItemCard({ item, type, onDeleted }: { item: SavedRecipe | SavedBeverage, type: 'recipe' | 'beverage', onDeleted: (id: string, type: 'recipe' | 'beverage') => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
    const [eventTime, setEventTime] = useState<string>('17:00');
    const [generatingImage, setGeneratingImage] = useState(false);
    const [imageUrl, setImageUrl] = useState(item.imageUrl);

    const isBeverage = type === 'beverage';
    const asBeverage = item as SavedBeverage;
    const asRecipe = item as SavedRecipe;

    useEffect(() => {
        const fetchUsers = async () => {
          if (!firestore || !user) return;
          const usersCol = collection(firestore, 'users');
          const usersSnapshot = await getDocs(usersCol);
          const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setUsers(usersList.filter(u => u.uid !== user.uid));
        };
    
        if (isMessageDialogOpen) {
          fetchUsers();
        }
    }, [isMessageDialogOpen, firestore, user]);

    const handleDelete = async () => {
        if (!user || !firestore) return;
        const collectionName = isBeverage ? 'savedBeverages' : 'savedRecipes';
        const itemRef = doc(firestore, 'users', user.uid, collectionName, item.id);
        try {
            await deleteDoc(itemRef);
            toast({
                title: "Item Deleted",
                description: `"${item.title}" has been removed from your saved items.`
            });
            onDeleted(item.id, type);
        } catch (error) {
            console.error("Error deleting item: ", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Could not delete item. Please try again."
            });
        }
        setIsDeleteDialogOpen(false);
    };
    
    const handlePostItem = async () => {
        if (!user || !firestore) return;
        const postsCol = collection(firestore, 'posts');
        
        const postData: any = {
          authorId: user.uid,
          author: { displayName: user.displayName, photoURL: user.photoURL, username: user.email?.split('@')[0] || '' },
          content: `Check out this ${type}: '${'\'\''}${item.title}${'\'\''}'!`,
          isPublic: true,
          likeCount: 0,
          commentCount: 0,
          createdAt: serverTimestamp(),
        }

        if (isBeverage) {
            postData.beverageRecipe = { ...item, savedAt: undefined, id: undefined };
        } else {
            postData.recipe = { ...item, savedAt: undefined, id: undefined };
        }

        addDocumentNonBlocking(postsCol, postData);
        toast({ title: 'Posted to Feed!', description: `"${item.title}" has been shared.` });
    };

    const handleSendMessage = (receiverId: string) => {
        if (!user || !firestore) return;
        
        const chatId = [user.uid, receiverId].sort().join('-');
        const messagesCol = collection(firestore, 'messages', chatId, 'chat');

        addDocumentNonBlocking(messagesCol, {
            senderId: user.uid,
            receiverId: receiverId,
            text: `Check out this ${type}: "${item.title}"!`,
            createdAt: serverTimestamp(),
            read: false,
        });
        toast({ title: "Message Sent!", description: `${type.charAt(0).toUpperCase() + type.slice(1)} shared.` });
        setIsMessageDialogOpen(false);
    };

    const handleCreateEvent = () => {
        if (!user || !firestore || !eventDate) return;
        const [hours, minutes] = eventTime.split(':').map(Number);
        const finalEventDate = new Date(eventDate);
        finalEventDate.setHours(hours, minutes);

        const eventsCol = collection(firestore, 'events');
        addDocumentNonBlocking(eventsCol, {
            title: `${isBeverage ? 'Mixology' : 'Cooking'} Session: ${item.title}`,
            description: `Let's make "${item.title}" together!`,
            createdBy: user.uid,
            startTime: finalEventDate,
            endTime: new Date(finalEventDate.getTime() + 60 * 60 * 1000),
            location: "My Kitchen/Bar",
            participantIds: [user.uid],
            attendees: [user.uid],
            status: 'scheduled',
        });
        toast({ title: "Event Created!", description: `Your session is on the calendar.` });
        setIsEventDialogOpen(false);
    };
    
    const handleGenerateImage = async () => {
        setGeneratingImage(true);
        try {
          const result = isBeverage
            ? await generateBeverageImage({ beverageName: item.title })
            : await generateFoodImage({ dishName: item.title });
          
          setImageUrl(result.imageUrl);
          // Here you might want to also save the new imageUrl to the saved item in Firestore
        } catch (e) {
          console.error(e);
          toast({ variant: 'destructive', title: 'Image Generation Failed' });
        } finally {
          setGeneratingImage(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <CardTitle>{item.title}</CardTitle>
                            <CardDescription>Saved on: {new Date((item as any).savedAt.seconds * 1000).toLocaleDateString()}</CardDescription>
                        </div>
                        {isBeverage && (
                             <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${asBeverage.isAlcoholic ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {asBeverage.isAlcoholic ? 'Alcoholic' : 'Non-Alcoholic'}
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     {generatingImage ? (
                          <Skeleton className="w-full aspect-video rounded-md" />
                        ) : imageUrl ? (
                          <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                            <Image src={imageUrl} alt={item.title} layout="fill" objectFit="cover" />
                          </div>
                        ) : (
                          <Button 
                            variant="outline"
                            className="w-full" 
                            onClick={handleGenerateImage}
                            disabled={generatingImage}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Image
                          </Button>
                        )}
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="ingredients">
                            <div className="flex items-center justify-between w-full pr-4">
                                <AccordionTrigger><h3 className="font-semibold">Ingredients</h3></AccordionTrigger>
                                <AudioPlayer text={item.ingredients.join(', ')} itemKey={`ing-${item.id}`} />
                            </div>
                            <AccordionContent>
                                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                    {item.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="instructions">
                            <div className="flex items-center justify-between w-full pr-4">
                                <AccordionTrigger><h3 className="font-semibold">Instructions</h3></AccordionTrigger>
                                <AudioPlayer text={item.instructions.join('. ')} itemKey={`ins-${item.id}`} />
                            </div>
                            <AccordionContent>
                                <ol className="list-decimal space-y-2 pl-5">
                                    {item.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                </ol>
                            </AccordionContent>
                        </AccordionItem>
                         {!isBeverage && (asRecipe.nutritionalInfo || asRecipe.costInfo) && (
                           <Card className="bg-muted/50 mt-4">
                                <CardContent className="p-4 grid gap-4 sm:grid-cols-2">
                                    {asRecipe.costInfo && (
                                        <div>
                                            <h4 className="font-semibold">Estimated Cost</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Total: ~${asRecipe.costInfo.totalCost.toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                    {asRecipe.nutritionalInfo && (
                                         <div>
                                            <h4 className="font-semibold">Nutritional Information</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Calories: {asRecipe.nutritionalInfo.calories} | 
                                                Protein: {asRecipe.nutritionalInfo.protein}g | 
                                                Carbs: {asRecipe.nutritionalInfo.totalCarbohydrates}g | 
                                                Fat: {asRecipe.nutritionalInfo.totalFat}g
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </Accordion>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                    <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button>
                            <Share2 className="mr-2 h-4 w-4" /> Share
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                        <DropdownMenuItem onClick={handlePostItem}>
                            <Send className="mr-2 h-4 w-4" /> Post to Feed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsMessageDialogOpen(true)}>
                            <MessageSquare className="mr-2 h-4 w-4" /> Send as Message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsEventDialogOpen(true)}>
                            <CalendarPlus className="mr-2 h-4 w-4" /> Create Event
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardFooter>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{item.title}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send to a Friend</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
                        {users.map(u => (
                            <Button key={u.uid} variant="outline" className="w-full justify-start" onClick={() => u.uid && handleSendMessage(u.uid)}>
                                {u.displayName}
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Event</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                                        <CalendarPlus className="mr-2 h-4 w-4" />
                                        {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsEventDialogOpen(false)} variant="ghost">Cancel</Button>
                        <Button onClick={handleCreateEvent}>Create Event</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function SavedGroceryListCard({ list, onDeleted }: { list: SavedGroceryList, onDeleted: (id: string) => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
          if (!firestore || !user) return;
          const usersCol = collection(firestore, 'users');
          const usersSnapshot = await getDocs(usersCol);
          const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setUsers(usersList.filter(u => u.uid !== user.uid));
        };
    
        if (isMessageDialogOpen) {
          fetchUsers();
        }
    }, [isMessageDialogOpen, firestore, user]);

    const handleDelete = async () => {
        if (!user || !firestore) return;
        const listRef = doc(firestore, 'users', user.uid, 'groceryLists', list.id);
        try {
            await deleteDoc(listRef);
            toast({
                title: "List Deleted",
                description: `"${list.title}" has been removed.`
            });
            onDeleted(list.id);
        } catch (error) {
            console.error("Error deleting list: ", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Could not delete the list. Please try again."
            });
        }
        setIsDeleteDialogOpen(false);
    };

    const handlePostList = async () => {
        if (!user || !firestore) return;
        const postsCol = collection(firestore, 'posts');
        
        let content = `My grocery list: ${list.title}\n`;
        list.categories.forEach(cat => {
            content += `\n**${cat.name}**\n`;
            cat.items.forEach(item => {
                content += `- ${item.name} (${item.quantity})\n`;
            });
        });
        content += `\n**Total: ~${list.currency} ${list.totalCost.toFixed(2)}**`;

        addDocumentNonBlocking(postsCol, {
          authorId: user.uid,
          author: { displayName: user.displayName, photoURL: user.photoURL, username: user.email?.split('@')[0] || '' },
          content: content,
          groceryList: list,
          isPublic: true,
          likeCount: 0,
          commentCount: 0,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'List Posted!', description: `Your grocery list has been shared.` });
    };

    const handleSendMessage = (receiverId: string) => {
        if (!user || !firestore) return;
        
        const chatId = [user.uid, receiverId].sort().join('-');
        const messagesCol = collection(firestore, 'messages', chatId, 'chat');
        let messageText = `Here's my grocery list: "${list.title}"! Total is about ${list.currency} ${list.totalCost.toFixed(2)}.`;

        addDocumentNonBlocking(messagesCol, {
            senderId: user.uid,
            receiverId: receiverId,
            text: messageText,
            createdAt: serverTimestamp(),
            read: false,
        });
        toast({ title: "Message Sent!", description: `List shared.` });
        setIsMessageDialogOpen(false);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{list.title}</CardTitle>
                    <CardDescription>
                        Saved on: {new Date((list as any).savedAt.seconds * 1000).toLocaleDateString()} | Total: {list.currency} ${list.totalCost.toFixed(2)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {list.categories.map((category, catIndex) => (
                            <AccordionItem key={catIndex} value={`category-${catIndex}`}>
                                <AccordionTrigger>
                                    <h3 className="font-semibold">{category.name}</h3>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <ul className="space-y-1 text-sm text-muted-foreground">
                                        {category.items.map((item, itemIndex) => (
                                            <li key={itemIndex} className="grid grid-cols-[1fr_auto_auto] gap-4">
                                                <span>{item.name}</span>
                                                <span className="text-right">{item.quantity}</span>
                                                <span className="text-right">{list.currency} {item.cost?.toFixed(2) || 'N/A'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                    <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button><Share2 className="mr-2 h-4 w-4" /> Share</Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={handlePostList}><Send className="mr-2 h-4 w-4" /> Post to Feed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsMessageDialogOpen(true)}><MessageSquare className="mr-2 h-4 w-4" /> Send as Message</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardFooter>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete "{list.title}".</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Send Grocery List</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
                        {users.map(u => (
                            <Button key={u.uid} variant="outline" className="w-full justify-start" onClick={() => u.uid && handleSendMessage(u.uid)}>{u.displayName}</Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

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

function SavedProductLabelCard({ card, onDeleted }: { card: SavedProductLabel, onDeleted: (id: string) => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [imageUrl, setImageUrl] = useState(card.imageUrl);


    useEffect(() => {
        const fetchUsers = async () => {
          if (!firestore || !user) return;
          const usersCol = collection(firestore, 'users');
          const usersSnapshot = await getDocs(usersCol);
          const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setUsers(usersList.filter(u => u.uid !== user.uid));
        };
    
        if (isMessageDialogOpen) {
          fetchUsers();
        }
    }, [isMessageDialogOpen, firestore, user]);

    const handleDelete = async () => {
        if (!user || !firestore) return;
        const cardRef = doc(firestore, 'users', user.uid, 'productLabels', card.id);
        try {
            await deleteDoc(cardRef);
            toast({ title: "Card Deleted", description: `"${card.productName}" has been removed.`});
            onDeleted(card.id);
        } catch (error) {
            console.error("Error deleting card: ", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not delete the card."});
        }
        setIsDeleteDialogOpen(false);
    };

    const handlePostCard = async () => {
        if (!user || !firestore) return;
        const postsCol = collection(firestore, 'posts');
        let content = `I analyzed "${card.productName}" and it got a score of ${card.overallScore}/100!`;

        addDocumentNonBlocking(postsCol, {
          authorId: user.uid,
          author: { displayName: user.displayName, photoURL: user.photoURL, username: user.email?.split('@')[0] || '' },
          content: content,
          productLabel: card,
          isPublic: true,
          likeCount: 0,
          commentCount: 0,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Card Posted!', description: `The analysis has been shared.` });
    };

    const handleSendMessage = (receiverId: string) => {
        if (!user || !firestore) return;
        const chatId = [user.uid, receiverId].sort().join('-');
        const messagesCol = collection(firestore, 'messages', chatId, 'chat');
        let messageText = `Check out this analysis for "${card.productName}". It scored ${card.overallScore}/100.`;

        addDocumentNonBlocking(messagesCol, {
            senderId: user.uid,
            receiverId: receiverId,
            text: messageText,
            createdAt: serverTimestamp(),
            read: false,
        });
        toast({ title: "Message Sent!", description: `Analysis shared.` });
        setIsMessageDialogOpen(false);
    };

    return (
         <>
            <Card>
                <CardHeader>
                    <CardTitle>{card.productName}</CardTitle>
                    <CardDescription>Saved on: {new Date((card as any).savedAt.seconds * 1000).toLocaleDateString()}</CardDescription>
                     <div className="flex items-center gap-4 pt-2">
                        <div className="text-3xl font-bold">{card.overallScore}<span className="text-lg text-muted-foreground">/100</span></div>
                        <div className="flex-1">
                            <Progress value={card.overallScore} className={cn("h-3", getScoreColor(card.overallScore))} />
                            <div className="text-xs font-medium flex items-center gap-2 mt-1">
                                {getRiskIndicator(card.overallRisk)} {card.overallRisk}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {imageUrl && (
                        <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                            <Image src={imageUrl} alt={card.productName} fill objectFit="cover" />
                        </div>
                    )}

                    <p className="italic text-sm text-muted-foreground mb-4">{card.summary}</p>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="ingredients">
                            <AccordionTrigger><h3 className="font-semibold">Ingredient Analysis</h3></AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {card.ingredients.map((item, index) => (
                                        <div key={index} className="p-2 rounded-md border bg-background/30">
                                            <div className="flex justify-between items-center">
                                                <p className="font-medium text-sm">{item.name}</p>
                                                <div className="flex items-center gap-2 text-xs font-semibold">
                                                    {getRiskIndicator(item.risk)} {item.risk}
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{item.explanation}</p>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                    <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button><Share2 className="mr-2 h-4 w-4" /> Share</Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={handlePostCard}><Send className="mr-2 h-4 w-4" /> Post to Feed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsMessageDialogOpen(true)}><MessageSquare className="mr-2 h-4 w-4" /> Send as Message</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardFooter>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete "{card.productName}".</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                 <DialogContent>
                    <DialogHeader><DialogTitle>Send Product Analysis</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
                        {users.map(u => (
                            <Button key={u.uid} variant="outline" className="w-full justify-start" onClick={() => u.uid && handleSendMessage(u.uid)}>{u.displayName}</Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}


export default function SavedPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[] | null>(null);
  const [savedBeverages, setSavedBeverages] = useState<SavedBeverage[] | null>(null);
  const [savedGroceryLists, setSavedGroceryLists] = useState<SavedGroceryList[] | null>(null);
  const [savedProductLabels, setSavedProductLabels] = useState<SavedProductLabel[] | null>(null);

  const savedRecipesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'savedRecipes'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);
  const { data: initialRecipes, isLoading: isLoadingRecipes } = useCollection<SavedRecipe>(savedRecipesQuery);

  const savedBeveragesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'savedBeverages'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);
  const { data: initialBeverages, isLoading: isLoadingBeverages } = useCollection<SavedBeverage>(savedBeveragesQuery);

  const savedGroceryListsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'groceryLists'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);
  const { data: initialGroceryLists, isLoading: isLoadingGroceryLists } = useCollection<SavedGroceryList>(savedGroceryListsQuery);

  const savedProductLabelsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'productLabels'), orderBy('savedAt', 'desc'));
  }, [user, firestore]);
  const { data: initialProductLabels, isLoading: isLoadingProductLabels } = useCollection<SavedProductLabel>(savedProductLabelsQuery);


  useEffect(() => { if (initialRecipes) setSavedRecipes(initialRecipes); }, [initialRecipes]);
  useEffect(() => { if (initialBeverages) setSavedBeverages(initialBeverages); }, [initialBeverages]);
  useEffect(() => { if (initialGroceryLists) setSavedGroceryLists(initialGroceryLists); }, [initialGroceryLists]);
  useEffect(() => { if (initialProductLabels) setSavedProductLabels(initialProductLabels); }, [initialProductLabels]);


  const handleItemDeleted = (deletedId: string, type: 'recipe' | 'beverage') => {
    if (type === 'recipe') {
        setSavedRecipes(prev => prev ? prev.filter(recipe => recipe.id !== deletedId) : null);
    } else {
        setSavedBeverages(prev => prev ? prev.filter(beverage => beverage.id !== deletedId) : null);
    }
  }

  const handleGroceryListDeleted = (deletedId: string) => {
    setSavedGroceryLists(prev => prev ? prev.filter(list => list.id !== deletedId) : null);
  }

  const handleProductLabelDeleted = (deletedId: string) => {
    setSavedProductLabels(prev => prev ? prev.filter(card => card.id !== deletedId) : null);
  }
  
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">Your Saved Collection</h1>
        <Tabs defaultValue="recipes">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="recipes"><ChefHat className="mr-2 h-4 w-4" /> Recipes</TabsTrigger>
                <TabsTrigger value="beverages"><Martini className="mr-2 h-4 w-4" /> Beverages</TabsTrigger>
                <TabsTrigger value="grocery"><ShoppingCart className="mr-2 h-4 w-4" /> Lists</TabsTrigger>
                <TabsTrigger value="labels"><ScanLine className="mr-2 h-4 w-4" /> Labels</TabsTrigger>
            </TabsList>
            <TabsContent value="recipes">
                {isLoadingRecipes && <ListSkeleton />}
                {!isLoadingRecipes && savedRecipes && savedRecipes.length > 0 && (
                    <div className="space-y-4 pt-4">
                        {savedRecipes.map(recipe => (
                            <SavedItemCard key={recipe.id} item={recipe} type="recipe" onDeleted={handleItemDeleted}/>
                        ))}
                    </div>
                )}
                {!isLoadingRecipes && (!savedRecipes || savedRecipes.length === 0) && (
                    <EmptyState itemType="Recipes" />
                )}
            </TabsContent>
            <TabsContent value="beverages">
                 {isLoadingBeverages && <ListSkeleton />}
                {!isLoadingBeverages && savedBeverages && savedBeverages.length > 0 && (
                    <div className="space-y-4 pt-4">
                        {savedBeverages.map(beverage => (
                            <SavedItemCard key={beverage.id} item={beverage} type="beverage" onDeleted={handleItemDeleted}/>
                        ))}
                    </div>
                )}
                {!isLoadingBeverages && (!savedBeverages || savedBeverages.length === 0) && (
                    <EmptyState itemType="Beverages" />
                )}
            </TabsContent>
            <TabsContent value="grocery">
                 {isLoadingGroceryLists && <ListSkeleton />}
                {!isLoadingGroceryLists && savedGroceryLists && savedGroceryLists.length > 0 && (
                    <div className="space-y-4 pt-4">
                        {savedGroceryLists.map(list => (
                            <SavedGroceryListCard key={list.id} list={list} onDeleted={handleGroceryListDeleted}/>
                        ))}
                    </div>
                )}
                {!isLoadingGroceryLists && (!savedGroceryLists || savedGroceryLists.length === 0) && (
                    <EmptyState itemType="Grocery Lists" />
                )}
            </TabsContent>
             <TabsContent value="labels">
                 {isLoadingProductLabels && <ListSkeleton />}
                {!isLoadingProductLabels && savedProductLabels && savedProductLabels.length > 0 && (
                    <div className="space-y-4 pt-4">
                        {savedProductLabels.map(card => (
                            <SavedProductLabelCard key={card.id} card={card} onDeleted={handleProductLabelDeleted}/>
                        ))}
                    </div>
                )}
                {!isLoadingProductLabels && (!savedProductLabels || savedProductLabels.length === 0) && (
                    <EmptyState itemType="Product Labels" />
                )}
            </TabsContent>
        </Tabs>
    </div>
  );
}
