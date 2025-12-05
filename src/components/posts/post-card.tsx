
'use client';

import Image from 'next/image';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Trash2, Send, CalendarPlus, Sparkles, Play, Pause, Loader2, MapPin, ShoppingCart, Video, Utensils, Tag, ScanLine, Twitter, Facebook, Link as LinkIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc, collection, getDocs, query, orderBy, writeBatch, increment, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn, getInitials } from '@/lib/utils';
import type { Recipe, BeverageRecipe, User, GroceryList, Comment, Like, NutritionalInfo, ProductLabelCard, Post } from '@/lib/types';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { textToSpeech } from '@/ai/flows/tts';
import { generateFoodImage } from '@/ai/flows/generate-food-image';
import { generateBeverageImage } from '@/ai/flows/generate-beverage-image';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Input } from '../ui/input';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { useCollection } from '@/firebase/firestore/use-collection';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type PostAuthor = Post['author'];

type PostCardProps = {
  id: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  location?: string;
  tags?: string[];
  externalVideoUrl?: string;
  recipe?: Recipe;
  beverageRecipe?: BeverageRecipe;
  groceryList?: GroceryList;
  productLabel?: ProductLabelCard;
  mediaURL?: string;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  hostUrl: string;
};

const getVideoEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    // YouTube
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch && youtubeMatch[1]) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // TikTok
    const tiktokRegex = /https:\/\/(?:www\.)?tiktok\.com\/.*\/video\/(\d+)/;
    const tiktokMatch = url.match(tiktokRegex);
    if (tiktokMatch && tiktokMatch[1]) {
        return `https://www.tiktok.com/embed/v2/video/${tiktokMatch[1]}`;
    }

    return null;
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
        return () => { if (audioElement) audioElement.removeEventListener('ended', handleEnded); };
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


function CommentsDialog({ post, commentCount: initialCommentCount }: { post: Omit<PostCardProps, 'hostUrl'>; commentCount: number }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
  }, [firestore, post.id]);
  const { data: comments, isLoading: isLoadingComments } = useCollection<Comment>(commentsQuery);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || !newComment.trim()) return;
    setIsSubmitting(true);

    const postRef = doc(firestore, 'posts', post.id);
    const commentsCol = collection(postRef, 'comments');
    const newCommentRef = doc(commentsCol);

    const commentData = {
      id: newCommentRef.id,
      postId: post.id,
      authorId: user.uid,
      author: {
        displayName: user.displayName,
        photoURL: user.photoURL,
        username: user.email?.split('@')[0] || ''
      },
      text: newComment,
      createdAt: serverTimestamp(),
    };
    
    const batch = writeBatch(firestore);
    batch.set(newCommentRef, commentData);
    batch.update(postRef, { commentCount: increment(1) });

    batch.commit()
      .then(() => {
        setNewComment('');
      })
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: newCommentRef.path,
            operation: 'create',
            requestResourceData: commentData,
        }));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };
  

  return (
    <DialogContent className="sm:max-w-[525px]">
      <DialogHeader>
        <DialogTitle>Comments</DialogTitle>
      </DialogHeader>
      <ScrollArea className="h-[400px] pr-6 -mr-6">
        <div className="space-y-4">
          {isLoadingComments ? (
            <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
          ) : comments && comments.length > 0 ? (
            comments.map(comment => (
              <div key={comment.id} className="flex items-start gap-4">
                <Avatar>
                  <AvatarImage src={comment.author.photoURL ?? ''} />
                  <AvatarFallback>{getInitials(comment.author.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{comment.author.displayName}</p>
                         {comment.createdAt && (
                           <p className="text-xs text-muted-foreground">{format(comment.createdAt.toDate(), 'PP')}</p>
                         )}
                    </div>
                  <p>{comment.text}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center">No comments yet. Be the first to comment!</p>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleCommentSubmit} className="flex items-start gap-4 pt-4">
        <Avatar>
          <AvatarImage src={user?.photoURL ?? ''} />
          <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
        </Avatar>
        <div className="w-full space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="min-h-[60px]"
          />
          <Button type="submit" disabled={isSubmitting || !newComment.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-2">Post</span>
          </Button>
        </div>
      </form>
    </DialogContent>
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

export function PostCard({
  id,
  authorId,
  author,
  content,
  location,
  tags,
  externalVideoUrl,
  recipe,
  beverageRecipe,
  groceryList,
  productLabel,
  mediaURL,
  likeCount: initialLikeCount,
  commentCount: initialCommentCount,
  createdAt,
  hostUrl,
}: PostCardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [timeAgo, setTimeAgo] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [eventTime, setEventTime] = useState<string>('17:00');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [itemImageUrl, setItemImageUrl] = useState(recipe?.imageUrl || beverageRecipe?.imageUrl || productLabel?.imageUrl);

  const [localLikeCount, setLocalLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(false);
  
  const postRef = useMemoFirebase(() => firestore ? doc(firestore, 'posts', id) : null, [firestore, id]);

  const likeRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'posts', id, 'likes', user.uid);
  }, [firestore, id, user]);

  useEffect(() => {
    if (!likeRef) return;
    const checkLiked = async () => {
      const likeSnap = await getDoc(likeRef);
      setIsLiked(likeSnap.exists());
    };
    checkLiked();
  }, [likeRef]);

  const handleLikeToggle = () => {
    if (!likeRef || !postRef || !firestore || !user) return;
    
    const wasLiked = isLiked;
    // Optimistic update
    setIsLiked(!wasLiked);
    setLocalLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    const batch = writeBatch(firestore);
    const likeData = { createdAt: serverTimestamp() };

    if (wasLiked) {
      batch.delete(likeRef);
      batch.update(postRef, { likeCount: increment(-1) });
    } else {
      batch.set(likeRef, likeData);
      batch.update(postRef, { likeCount: increment(1) });
    }

    batch.commit().catch(async (serverError) => {
        setIsLiked(wasLiked);
        setLocalLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: postRef.path, // report error on the parent post
            operation: 'update',
            requestResourceData: { likeCount: increment(wasLiked ? -1 : 1) },
        }));
    });
  };


  const isAuthor = user?.uid === authorId;
  const itemToSave = recipe || beverageRecipe || groceryList || productLabel;
  const isFoodRecipe = !!recipe;
  const isBeverageRecipe = !!beverageRecipe;
  const isGroceryList = !!groceryList;
  const isProductLabel = !!productLabel;

  let savedItemCollection: 'savedRecipes' | 'savedBeverages' | 'groceryLists' | 'productLabels' | null = null;
  if(isFoodRecipe) savedItemCollection = 'savedRecipes';
  if(isBeverageRecipe) savedItemCollection = 'savedBeverages';
  if(isGroceryList) savedItemCollection = 'groceryLists';
  if(isProductLabel) savedItemCollection = 'productLabels';
  
  const savedItemId = itemToSave ? `${'title' in itemToSave ? itemToSave.title.toLowerCase().replace(/\s+/g, '-') : (itemToSave as ProductLabelCard).productName.toLowerCase().replace(/\s+/g, '-')}-${id}` : null;


  const savedItemRef = useMemoFirebase(() => {
    if (!user || !firestore || !savedItemId || !savedItemCollection) return null;
    return doc(firestore, 'users', user.uid, savedItemCollection, savedItemId);
  }, [firestore, user, savedItemId, savedItemCollection]);
  
  const videoEmbedUrl = externalVideoUrl ? getVideoEmbedUrl(externalVideoUrl) : null;


  useEffect(() => {
    const calculateTimeAgo = (date: Date): string => {
      if (!date) return '';
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      let interval = seconds / 31536000; if (interval > 1) return Math.floor(interval) + "y ago";
      interval = seconds / 2592000; if (interval > 1) return Math.floor(interval) + "mo ago";
      interval = seconds / 86400; if (interval > 1) return Math.floor(interval) + "d ago";
      interval = seconds / 3600; if (interval > 1) return Math.floor(interval) + "h ago";
      interval = seconds / 60; if (interval > 1) return Math.floor(interval) + "m ago";
      return Math.floor(seconds) + "s ago";
    }
    if (createdAt) {
      setTimeAgo(calculateTimeAgo(createdAt));
    }
  }, [createdAt]);
  
  useEffect(() => {
    if (!savedItemRef) return;
    const checkIfSaved = async () => {
      const docSnap = await getDoc(savedItemRef);
      setIsSaved(docSnap.exists());
    };
    checkIfSaved();
  }, [savedItemRef]);
  
  useEffect(() => {
    if (!isMessageDialogOpen || !firestore || !user) return;
    const fetchUsers = async () => {
      const usersCol = collection(firestore, 'users');
      const usersSnapshot = await getDocs(usersCol);
      const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(usersList.filter(u => u.uid !== user.uid));
    };
    fetchUsers();
  }, [isMessageDialogOpen, firestore, user]);

  const handleSaveItem = () => {
    if (!savedItemRef || !itemToSave) return;
    if (isSaved) {
      deleteDoc(savedItemRef).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: savedItemRef.path,
          operation: 'delete'
        }));
      });
      setIsSaved(false);
      toast({ title: 'Unsaved' });
    } else {
      setDoc(savedItemRef, { ...itemToSave, savedAt: serverTimestamp() }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: savedItemRef.path,
          operation: 'create',
          requestResourceData: { ...itemToSave, savedAt: 'SERVER_TIMESTAMP' }
        }));
      });
      setIsSaved(true);
      toast({ title: 'Saved!' });
    }
  };
  
  const handleDeletePost = async () => {
    if (!firestore || !postRef) return;
    deleteDoc(postRef)
      .then(() => toast({ title: "Post Deleted" }))
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: postRef.path,
          operation: 'delete'
        }));
    });
    setIsDeleteDialogOpen(false);
  };
  
  const handleGenerateImage = async () => {
    if (!itemToSave || isGroceryList) return;
    setGeneratingImage(true);
    try {
      const result = isFoodRecipe
        ? await generateFoodImage({ dishName: (itemToSave as Recipe).title })
        : await generateBeverageImage({ beverageName: (itemToSave as BeverageRecipe).title });
      
      setItemImageUrl(result.imageUrl);
      // NOTE: This only updates the local state. The change is not persisted on the post document.
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Image Generation Failed' });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSendMessage = (receiverId: string) => {
    if (!user || !firestore || !itemToSave) return;
    const chatId = [user.uid, receiverId].sort().join('-');
    const messagesCol = collection(firestore, 'messages', chatId, 'chat');
    const itemName = 'title' in itemToSave ? itemToSave.title : (itemToSave as ProductLabelCard).productName;
    let itemType = isFoodRecipe ? 'recipe' : isBeverageRecipe ? 'drink' : isGroceryList ? 'list' : 'product';
    
    addDoc(messagesCol, {
        senderId: user.uid,
        text: `Check out this ${itemType}: "${itemName}"!`,
        createdAt: serverTimestamp(), read: false,
    }).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: messagesCol.path,
        operation: 'create',
        requestResourceData: { senderId: user.uid, text: `Check out this ${itemType}: "${itemName}"!` }
      }));
    });
    toast({ title: "Message Sent!" });
    setIsMessageDialogOpen(false);
  };

  const handleCreateEvent = () => {
    if (!user || !firestore || !itemToSave || !eventDate || isGroceryList || isProductLabel) return;
    const [hours, minutes] = eventTime.split(':').map(Number);
    const finalEventDate = new Date(eventDate);
    finalEventDate.setHours(hours, minutes);

    const eventData = {
        title: `${isFoodRecipe ? 'Cooking' : 'Mixing'} Session: ${(itemToSave as Recipe | BeverageRecipe).title}`,
        description: `Let's make "${(itemToSave as Recipe | BeverageRecipe).title}" together!`,
        createdBy: user.uid,
        startTime: finalEventDate,
        endTime: new Date(finalEventDate.getTime() + 60 * 60 * 1000),
        location: "My Kitchen/Bar",
        participantIds: [user.uid],
        attendees: [user.uid],
        status: 'scheduled',
    };
    
    addDoc(collection(firestore, 'events'), eventData)
      .then(() => toast({ title: "Event Created!" }))
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'events',
          operation: 'create',
          requestResourceData: eventData
        }));
      });
      
    setIsEventDialogOpen(false);
  };

  const handleLocationClick = () => {
      if (location) {
          const query = encodeURIComponent(location);
          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      }
  };
  
  const getOrderUrl = (service: 'instacart' | 'doordash' | 'ubereats' | 'google') => {
    const ingredients = groceryList 
        ? groceryList.categories.flatMap(c => c.items.map(i => i.name)) 
        : recipe?.ingredients || beverageRecipe?.ingredients;
    const query = encodeURIComponent(ingredients?.join(', ') || 'groceries');

    switch (service) {
      case 'instacart':
        return `https://www.instacart.com/store/search/${query}`;
      case 'doordash':
        return `https://www.doordash.com/search/store/${query}/`;
      case 'ubereats':
        return `https://www.ubereats.com/search?q=${query}`;
      case 'google':
        return `https://www.google.com/search?q=buy+${query}&tbm=shop`;
      default:
        return `https://www.google.com/search?q=buy+${query}`;
    }
  };

  const shouldShowOrderButton = (groceryList || recipe || beverageRecipe);
  const shouldShowRestaurantOrderButton = !!location;

  const itemDetails = recipe || beverageRecipe;

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

  const shareUrl = `${hostUrl}/${authorId}?post=${id}`;
  const shareText = `Check out this post from ${author.displayName}!`;

  const handleSocialShare = (platform: 'twitter' | 'facebook') => {
    let url = '';
    if (platform === 'twitter') {
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    } else if (platform === 'facebook') {
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
        toast({ title: 'Link Copied!', description: 'The post link has been copied to your clipboard.' });
    }, (err) => {
        console.error('Could not copy text: ', err);
        toast({ variant: 'destructive', title: 'Failed to Copy', description: 'Could not copy the link.' });
    });
  };
  
  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Link href={`/${authorId}`} className="flex-shrink-0">
            <Avatar>
              <AvatarImage src={author.photoURL ?? undefined} alt={author.displayName || ''} data-ai-hint="person portrait" />
              <AvatarFallback>{getInitials(author.displayName)}</AvatarFallback>
            </Avatar>
        </Link>
        <div className="flex-1">
          <Link href={`/${authorId}`} className="font-semibold hover:underline">
              {author.displayName}
          </Link>
          <p className="text-sm text-muted-foreground">{timeAgo || '...'}</p>
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {itemToSave && (
                    <DropdownMenuItem onClick={handleSaveItem}>
                        <Bookmark className={cn("mr-2 h-4 w-4", isSaved && "fill-primary text-primary")} />
                        <span>{isSaved ? 'Unsave' : 'Save'}</span>
                    </DropdownMenuItem>
                )}
                 {isAuthor && (
                    <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Post</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>

      </CardHeader>
      <CardContent className="space-y-4">
        {content && <p className="whitespace-pre-wrap">{content}</p>}
        
        {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer hover:bg-primary/20">#{tag}</Badge>
                ))}
            </div>
        )}

        {location && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLocationClick}>
                <MapPin className="h-4 w-4" />
                {location}
            </Button>
        )}
        
        {videoEmbedUrl ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
            <iframe
              src={videoEmbedUrl}
              title="Embedded Video"
              className="absolute top-0 left-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : mediaURL && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border">
            <Image src={mediaURL} alt="Post media" fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" data-ai-hint="social media post"/>
          </div>
        )}


        {itemDetails && (
            <Card className="bg-muted/50">
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <CardTitle>{itemDetails.title}</CardTitle>
                    <CardDescription>{itemDetails.description || (isFoodRecipe ? `Serving Size: ${(itemDetails as Recipe).servingSize}` : `Serve in a ${(itemDetails as BeverageRecipe).glassware}`)}</CardDescription>
                  </div>
                  {beverageRecipe && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${beverageRecipe.isAlcoholic ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {beverageRecipe.isAlcoholic ? 'Alcoholic' : 'Non-Alcoholic'}
                      </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatingImage ? (
                    <Skeleton className="w-full aspect-video rounded-md" />
                ) : itemImageUrl ? (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                        <Image src={itemImageUrl} alt={itemDetails.title} fill objectFit="cover" />
                    </div>
                ) : (
                    <Button variant="outline" className="w-full" onClick={handleGenerateImage} disabled={generatingImage}>
                        <Sparkles className="mr-2 h-4 w-4" /> Generate Image
                    </Button>
                )}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="ingredients">
                    <div className="flex items-center justify-between w-full pr-4">
                      <AccordionTrigger><h3 className="font-semibold">Ingredients</h3></AccordionTrigger>
                      <AudioPlayer text={itemDetails.ingredients.join(', ')} itemKey={`ing-${id}`} />
                    </div>
                    <AccordionContent>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {itemDetails.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="instructions">
                    <div className="flex items-center justify-between w-full pr-4">
                      <AccordionTrigger><h3 className="font-semibold">Instructions</h3></AccordionTrigger>
                      <AudioPlayer text={itemDetails.instructions.join('. ')} itemKey={`ins-${id}`} />
                    </div>
                    <AccordionContent>
                      <ol className="list-decimal space-y-2 pl-5">
                        {itemDetails.instructions.map((step, i) => <li key={i}>{step}</li>)}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                  {recipe && recipe.nutritionalInfo && (
                    <AccordionItem value="nutrition">
                        <AccordionTrigger>
                            <h3 className="font-semibold">Nutritional Information</h3>
                        </AccordionTrigger>
                        <AccordionContent>
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
                        </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CardContent>
            </Card>
        )}

        {groceryList && (
             <Card className="bg-muted/50">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        <CardTitle>{groceryList.title}</CardTitle>
                    </div>
                    <CardDescription>
                        Total Estimated Cost: {groceryList.currency} ${groceryList.totalCost.toFixed(2)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Accordion type="single" collapsible className="w-full">
                        {groceryList.categories.map((category, catIndex) => (
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
                                                <span className="text-right">{groceryList.currency} {item.cost?.toFixed(2) || 'N/A'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        )}

        {productLabel && (
            <Card className="bg-muted/50">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ScanLine className="h-5 w-5" />
                        <CardTitle className="font-headline text-xl">{productLabel.productName}</CardTitle>
                    </div>
                     <div className="flex items-center gap-4 pt-2">
                        <div className="text-3xl font-bold">{productLabel.overallScore}<span className="text-lg text-muted-foreground">/100</span></div>
                        <div className="flex-1">
                            <Progress value={productLabel.overallScore} className={cn("h-3", getScoreColor(productLabel.overallScore))} />
                            <div className="text-xs font-medium flex items-center gap-2 mt-1">
                                {getRiskIndicator(productLabel.overallRisk)} {productLabel.overallRisk}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="italic text-sm text-muted-foreground mb-4">{productLabel.summary}</p>
                    <Accordion type="single" collapsible className="w-full">
                         <AccordionItem value="ingredients">
                            <AccordionTrigger><h3 className="font-semibold">Ingredient Analysis</h3></AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2">
                                    {productLabel.ingredients.map((item, index) => (
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
            </Card>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
            {!videoEmbedUrl && externalVideoUrl && (
                <Button asChild variant="secondary">
                    <a href={externalVideoUrl} target="_blank" rel="noopener noreferrer">
                        <Video className="h-4 w-4 mr-2" /> Watch Video
                    </a>
                </Button>
            )}
            {shouldShowRestaurantOrderButton && (
                 <Button asChild>
                    <a href={`https://www.doordash.com/search/store/${encodeURIComponent(location || '')}/`} target="_blank" rel="noopener noreferrer">
                        <Utensils className="h-4 w-4 mr-2" />
                        Order from Restaurant
                    </a>
                </Button>
            )}
            {shouldShowOrderButton && !isProductLabel && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button>
                            <ShoppingCart className="h-4 w-4 mr-2" /> Order Ingredients
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Choose a Service</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <a href={getOrderUrl('instacart')} target="_blank" rel="noopener noreferrer" className="w-full">Instacart</a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href={getOrderUrl('doordash')} target="_blank" rel="noopener noreferrer" className="w-full">DoorDash</a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href={getOrderUrl('ubereats')} target="_blank" rel="noopener noreferrer" className="w-full">Uber Eats</a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href={getOrderUrl('google')} target="_blank" rel="noopener noreferrer" className="w-full">Google Shopping</a>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
      </CardContent>
      <Separator className="mx-6 w-auto" />
      <CardFooter className="p-2">
        <div className="flex w-full justify-around">
          <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground" onClick={handleLikeToggle}>
            <Heart className={cn("h-5 w-5", isLiked && "fill-red-500 text-red-500")} />
            <span>{localLikeCount}</span>
          </Button>
          <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground">
                    <MessageCircle className="h-5 w-5" />
                    <span>{initialCommentCount}</span>
                </Button>
            </DialogTrigger>
            <CommentsDialog post={{id, authorId, author, content, likeCount: localLikeCount, commentCount: initialCommentCount, createdAt}} commentCount={initialCommentCount} />
          </Dialog>
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground">
                    <Share2 className="h-5 w-5" />
                    <span>Share</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleSocialShare('twitter')}>
                    <Twitter className="mr-2 h-4 w-4" /> Share on Twitter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSocialShare('facebook')}>
                    <Facebook className="mr-2 h-4 w-4" /> Share on Facebook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                    <LinkIcon className="mr-2 h-4 w-4" /> Copy Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsMessageDialogOpen(true)}>
                    <MessageCircle className="mr-2 h-4 w-4" /> Send as Message
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEventDialogOpen(true)} disabled={!isFoodRecipe && !isBeverageRecipe}>
                    <CalendarPlus className="mr-2 h-4 w-4" /> Create Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </CardFooter>
    </Card>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this post?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Send to a Friend</DialogTitle></DialogHeader>
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
            <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus /></PopoverContent>
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

    
