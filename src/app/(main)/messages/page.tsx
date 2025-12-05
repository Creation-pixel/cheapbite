

'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { cn, getInitials } from '@/lib/utils';
import { Send, Plus, Search, Loader2 } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, writeBatch, serverTimestamp, getDoc, where, limit, endAt, startAt, addDoc, setDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Message, User, Conversation, PublicUserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogTrigger } from '@radix-ui/react-dialog';
import { format, isToday, isYesterday } from 'date-fns';


const formatTimestamp = (ts: any) => {
    if (!ts || !ts.toDate) return '';
    const date = ts.toDate();
    if (isToday(date)) return format(date, 'p');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'PP');
}


export default function MessagesPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const searchParams = useSearchParams();

    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const messageEndRef = useRef<HTMLDivElement>(null);
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [searchedUsers, setSearchedUsers] = useState<PublicUserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Conversations list
    const conversationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'conversations'), orderBy('lastUpdatedAt', 'desc'));
    }, [firestore, user]);
    const { data: conversations, isLoading: isLoadingConvos } = useCollection<Conversation>(conversationsQuery);
    
    // Chat ID for selected conversation
    const chatId = useMemo(() => {
        if (!user || !selectedConversation) return null;
        return [user.uid, selectedConversation.peerId].sort().join('-');
    }, [user, selectedConversation]);

    // Messages for selected chat
    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !chatId) return null;
        return query(collection(firestore, 'messages', chatId, 'chat'), orderBy('createdAt', 'asc'));
    }, [firestore, chatId]);
    const { data: messages, isLoading: isLoadingMessages } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        const targetUserId = searchParams.get('u');

        const initializeConversation = async () => {
             if (!conversations) return; // Wait until conversations are loaded

            if (targetUserId) {
                const existing = conversations.find(c => c.peerId === targetUserId);
                if (existing) {
                    setSelectedConversation(existing);
                } else if (firestore) {
                    // Create a temporary conversation object if one doesn't exist
                    const userProfileRef = doc(firestore, 'publicProfiles', targetUserId);
                    const userProfileSnap = await getDoc(userProfileRef);
                    if (userProfileSnap.exists()) {
                        const peerData = userProfileSnap.data() as PublicUserProfile;
                        setSelectedConversation({
                            id: peerData.uid,
                            peerId: peerData.uid,
                            peerData: { displayName: peerData.displayName, photoURL: peerData.photoURL },
                            lastMessage: 'Start a new conversation',
                            lastUpdatedAt: new Date() as any,
                        });
                    }
                }
            } else if (!selectedConversation && conversations.length > 0) {
                 setSelectedConversation(conversations[0]);
            }
        };
        
        initializeConversation();
    }, [conversations, searchParams, firestore, selectedConversation]);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Debounced user search effect
    useEffect(() => {
        const handleSearch = async () => {
            if (!firestore || !searchTerm.trim()) {
                setSearchedUsers([]);
                setIsSearching(false);
                return;
            }
            setIsSearching(true);
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            
            try {
                const usersCol = collection(firestore, 'publicProfiles');
                const q = query(
                    usersCol,
                    orderBy('displayName_lowercase'),
                    startAt(lowerCaseSearchTerm),
                    endAt(lowerCaseSearchTerm + '\uf8ff'),
                    limit(10)
                );
        
                const querySnapshot = await getDocs(q);
                const usersList = querySnapshot.docs
                    .map(doc => ({ uid: doc.id, ...doc.data() } as PublicUserProfile))
                    .filter(u => u.uid !== user?.uid);
                setSearchedUsers(usersList);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(handleSearch, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);

    }, [searchTerm, firestore, user]);

    const handleSelectUser = async (targetUser: PublicUserProfile) => {
        if (!user || !firestore) return;
        const existingConversation = conversations?.find(c => c.peerId === targetUser.uid);
        if (existingConversation) {
            setSelectedConversation(existingConversation);
        } else {
            // This is a new conversation. Create a temporary one in state.
            // It will be saved to Firestore when the first message is sent.
            setSelectedConversation({
                id: targetUser.uid,
                peerId: targetUser.uid,
                peerData: { 
                    displayName: targetUser.displayName, 
                    photoURL: targetUser.photoURL 
                },
                lastMessage: "Start a new conversation!",
                lastUpdatedAt: new Date() as any, // Temporary
            });
        }
        setIsNewChatOpen(false);
        setSearchTerm('');
        setSearchedUsers([]);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !user || !selectedConversation || !newMessage.trim() || !chatId) return;

        const { peerId, peerData } = selectedConversation;
        const messageText = newMessage;
        setNewMessage('');

        // Prepare all the documents we need to write to
        const messageData = { 
            senderId: user.uid, 
            text: messageText, 
            createdAt: serverTimestamp(), 
            read: false 
        };
        
        const chatColRef = collection(firestore, 'messages', chatId, 'chat');
        const newMsgRef = doc(chatColRef);
        
        const currentUserConvRef = doc(firestore, 'users', user.uid, 'conversations', peerId);
        const peerUserConvRef = doc(firestore, 'users', peerId, 'conversations', user.uid);
        
        const currentUserConversationUpdate = {
            peerId: peerId,
            peerData: peerData,
            lastMessage: messageText,
            lastUpdatedAt: serverTimestamp(),
        };

        const peerUserConversationUpdate = {
            peerId: user.uid,
            peerData: {
                displayName: user.displayName,
                photoURL: user.photoURL,
            },
            lastMessage: messageText,
            lastUpdatedAt: serverTimestamp(),
        };

        try {
            const batch = writeBatch(firestore);
            
            // 1. Create the new message document
            batch.set(newMsgRef, messageData);
            
            // 2. Create/update the conversation record for the sender (current user)
            batch.set(currentUserConvRef, currentUserConversationUpdate, { merge: true });
            
            // 3. Create/update the conversation record for the receiver
            batch.set(peerUserConvRef, peerUserConversationUpdate, { merge: true });

            await batch.commit();

        } catch (serverError) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: newMsgRef.path, // We can report error on the message itself
                operation: 'create',
                requestResourceData: messageData, 
            }));
        }
    }


    return (
        <div className="flex h-[calc(100vh-8rem)] w-full flex-col">
            <div className="flex justify-between items-center mb-8">
                <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">Messages</h1>
                <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Chat
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Start a new conversation</DialogTitle>
                            <DialogDescription>Search for a user to start a new chat.</DialogDescription>
                        </DialogHeader>
                        <div className="relative">
                           <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input 
                                placeholder="Search by name or username..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-[300px]">
                            {isSearching ? (
                                <div className="p-4 flex items-center justify-center text-muted-foreground">
                                   <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                   <span>Searching...</span>
                               </div>
                            ) : searchedUsers.length > 0 ? (
                                <div className="space-y-2 pr-4">
                                    {searchedUsers.map(u => (
                                        <button key={u.uid} onClick={() => handleSelectUser(u)} className="w-full text-left p-2 hover:bg-muted/50 rounded-md transition-colors flex items-center gap-4">
                                            <Avatar>
                                                <AvatarImage src={u.photoURL ?? undefined} alt={u.displayName ?? undefined} />
                                                <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-semibold truncate">{u.displayName}</p>
                                                <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground pt-10">
                                    <p>{searchTerm ? "No users found." : "Search for users to start a chat."}</p>
                                </div>
                            )}
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-hidden border rounded-lg">
                <div className="flex flex-col border-r">
                    <h2 className="text-lg font-semibold p-4 border-b">Conversations</h2>
                    <ScrollArea className="flex-1">
                        {isLoadingConvos ? (
                           <div className="p-4 space-y-4">
                               <Skeleton className="h-12 w-full" />
                               <Skeleton className="h-12 w-full" />
                               <Skeleton className="h-12 w-full" />
                           </div>
                        ) : conversations && conversations.length > 0 ? (
                            conversations.map(convo => (
                                <button key={convo.id} onClick={() => setSelectedConversation(convo)} className={cn(
                                    'w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-4',
                                    selectedConversation?.id === convo.id && 'bg-muted'
                                )}>
                                    <Avatar>
                                        <AvatarImage src={convo.peerData.photoURL ?? ''} alt={convo.peerData.displayName ?? ''} data-ai-hint="person portrait" />
                                        <AvatarFallback>{getInitials(convo.peerData.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-semibold truncate">{convo.peerData.displayName}</p>
                                        <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
                                    </div>
                                    {convo.lastUpdatedAt && (
                                        <p className="text-xs text-muted-foreground self-start">{formatTimestamp(convo.lastUpdatedAt)}</p>
                                    )}
                                </button>
                            ))
                        ) : (
                           <div className="p-4 text-center text-muted-foreground">No conversations.</div>
                        )}
                    </ScrollArea>
                </div>
                <div className="md:col-span-2 lg:col-span-3 flex flex-col h-full">
                    {!selectedConversation ? (
                         <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a conversation to start messaging.</div>
                    ) : (
                        <>
                        <div className="p-4 border-b flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={selectedConversation.peerData.photoURL ?? ''} alt={selectedConversation.peerData.displayName ?? ''} data-ai-hint="person portrait"/>
                                <AvatarFallback>{getInitials(selectedConversation.peerData.displayName)}</AvatarFallback>
                            </Avatar>
                            <h3 className="text-lg font-semibold">{selectedConversation.peerData.displayName}</h3>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                           {isLoadingMessages ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-10 w-3/4 self-end" />
                                    <Skeleton className="h-10 w-3/4" />
                                    <Skeleton className="h-10 w-3/4 self-end" />
                                </div>
                           ) : (
                                <div className="space-y-4">
                                {messages && messages.map(msg => (
                                    <div key={msg.id} className={cn(
                                        'flex items-end gap-2',
                                        msg.senderId === user?.uid ? 'justify-end' : 'justify-start'
                                    )}>
                                        {msg.senderId !== user?.uid && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={selectedConversation.peerData.photoURL ?? ''} alt={selectedConversation.peerData.displayName ?? ''} data-ai-hint="person portrait"/>
                                                <AvatarFallback>{getInitials(selectedConversation.peerData.displayName)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn(
                                            'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2',
                                            msg.senderId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                        )}>
                                            <p>{msg.text}</p>
                                            {msg.createdAt && (
                                                <p className={cn('text-xs mt-1 text-right', msg.senderId === user?.uid ? 'text-primary-foreground/70' : 'text-muted-foreground/70')}>
                                                    {format(msg.createdAt.toDate(), 'p')}
                                                </p>
                                            )}
                                        </div>
                                        {msg.senderId === user?.uid && user?.photoURL && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user?.photoURL ?? ''} alt={user?.displayName ?? ''} data-ai-hint="person portrait"/>
                                                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                                 <div ref={messageEndRef} />
                                </div>
                           )}
                        </ScrollArea>
                        <div className="p-4 border-t">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <Input placeholder="Type a message..." className="flex-1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                                <Button type="submit" disabled={!newMessage.trim() || isLoadingMessages}>
                                    <Send className="h-4 w-4" />
                                    <span className="sr-only">Send</span>
                                </Button>
                            </form>
                        </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}


    
