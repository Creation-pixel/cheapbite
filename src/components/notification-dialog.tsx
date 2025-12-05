
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import notificationsData from '@/lib/notifications.json';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Notification = {
    title: string;
    description: string;
    link?: string;
};

// --- Configuration ---
const NOTIFICATION_INTERVAL = 1 * 60 * 1000; // 1 minute for testing. Change to 30 * 60 * 1000 for 30 minutes.
const POPUP_PAGES = ['/', '/recipes', '/drinks', '/offer-help'];
const RANDOM_CHANCE_PERCENT = 25; // 25% chance of showing on subsequent visits
const LAST_SHOWN_KEY = 'notification_last_shown';
const SESSION_START_KEY = 'app_session_started';


/**
 * A hook to manage displaying a recurring notification dialog.
 */
function useRecurringNotification() {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only run this logic on the specified pages
    if (!POPUP_PAGES.includes(pathname) || isOpen) {
        return;
    }

    const lastShownTimestamp = localStorage.getItem(LAST_SHOWN_KEY);
    const sessionStarted = sessionStorage.getItem(SESSION_START_KEY);
    const now = new Date().getTime();

    const timeSinceLastShown = lastShownTimestamp ? now - parseInt(lastShownTimestamp, 10) : Infinity;

    const shouldShowBasedOnTime = timeSinceLastShown > NOTIFICATION_INTERVAL;

    const decideWhatToShow = () => {
        // Implement the 1/3 cause, 2/3 cuisine logic
        const randomNumber = Math.random() * 3; // a number between 0 and 3
        let selectedNotification: Notification;

        if (randomNumber < 1) { // 1/3 chance for a 'cause' notification
            const causeNotifications = notificationsData.notifications.cause;
            selectedNotification = causeNotifications[Math.floor(Math.random() * causeNotifications.length)];
        } else { // 2/3 chance for a 'cuisine' notification
            const cuisineNotifications = notificationsData.notifications.cuisine;
            selectedNotification = cuisineNotifications[Math.floor(Math.random() * cuisineNotifications.length)];
        }
        
        setNotification(selectedNotification);
        setIsOpen(true);
        localStorage.setItem(LAST_SHOWN_KEY, now.toString());
    };
    
    if (!sessionStarted) {
        // This is the first launch of the session
        sessionStorage.setItem(SESSION_START_KEY, 'true');
        decideWhatToShow();
    } else {
        // This is a subsequent page visit
        const shouldShowRandomly = Math.random() < (RANDOM_CHANCE_PERCENT / 100);
        if (shouldShowBasedOnTime && shouldShowRandomly) {
            decideWhatToShow();
        }
    }

  }, [pathname, isOpen]); // Rerun when the page path changes or dialog closes

  const handleClose = () => {
    setIsOpen(false);
  };

  return { isOpen, notification, handleClose };
}


export function NotificationDialog() {
    const { isOpen, notification, handleClose } = useRecurringNotification();

    if (!notification) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{notification.title}</DialogTitle>
                    <DialogDescription>
                        {notification.description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-start">
                    <Button onClick={handleClose} variant="outline">Close</Button>
                    {notification.link && (
                         <Button asChild>
                           <Link href={notification.link} onClick={handleClose}>Learn More</Link>
                         </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
