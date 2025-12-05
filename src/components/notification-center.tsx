
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Heart, MessageSquare, UserPlus } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { getInitials } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';

function NotificationItem({ notification, onRead }: { notification: Notification, onRead: (id: string) => void }) {
    const router = useRouter();

    const handleClick = () => {
        onRead(notification.id);
        if (notification.type === 'follow') {
            router.push(`/${notification.senderId}`);
        } else if (notification.postId) {
            // This is a simplified navigation. A real app might need a dedicated post page.
            // For now, we navigate to the author's profile.
            router.push(`/${notification.recipientId}?post=${notification.postId}`);
        }
    };

    const getIcon = () => {
        switch (notification.type) {
            case 'like': return <Heart className="h-5 w-5 text-red-500" />;
            case 'comment': return <MessageSquare className="h-5 w-5 text-blue-500" />;
            case 'follow': return <UserPlus className="h-5 w-5 text-green-500" />;
            default: return <Bell className="h-5 w-5" />;
        }
    };
    
    const getText = () => {
        const senderName = <span className="font-semibold">{notification.sender.displayName || 'Someone'}</span>;
        switch(notification.type) {
            case 'like': return <>{senderName} liked your post.</>;
            case 'comment': return <>{senderName} commented: "{notification.commentText}"</>;
            case 'follow': return <>{senderName} started following you.</>;
            default: return <>You have a new notification.</>;
        }
    }

    return (
        <button onClick={handleClick} className="w-full text-left p-3 flex items-start gap-3 hover:bg-muted/50 rounded-lg transition-colors">
            <div className="relative">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={notification.sender.photoURL ?? ''} />
                    <AvatarFallback>{getInitials(notification.sender.displayName)}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full">
                    {getIcon()}
                </div>
            </div>
            <div className="flex-1">
                <p className="text-sm">{getText()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                </p>
            </div>
             {!notification.read && <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1" />}
        </button>
    );
}


export function NotificationCenter() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(20));
  }, [user, firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);
  
  const unreadCount = useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const markAllAsRead = () => {
    if (!firestore || !user || !notifications || unreadCount === 0) return;
    const batch = writeBatch(firestore);
    notifications.forEach(n => {
        if (!n.read) {
            const notifRef = doc(firestore, 'users', user.uid, 'notifications', n.id);
            batch.update(notifRef, { read: true });
        }
    });
    batch.commit().catch(console.error);
  };

  const markOneAsRead = (id: string) => {
    if (!firestore || !user) return;
    const notifRef = doc(firestore, 'users', user.uid, 'notifications', id);
    writeBatch(firestore).update(notifRef, { read: true }).commit().catch(console.error);
  };

  return (
    <Popover onOpenChange={(open) => { if (!open) markAllAsRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              {unreadCount}
            </div>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="p-2 flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && <Button variant="link" size="sm" onClick={markAllAsRead} className="p-0 h-auto">Mark all as read</Button>}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-2 space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="space-y-1">
              {notifications.map(n => <NotificationItem key={n.id} notification={n} onRead={markOneAsRead} />)}
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <p>No notifications yet.</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
