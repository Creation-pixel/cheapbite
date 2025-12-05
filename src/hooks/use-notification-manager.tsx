
'use client';

import { useState, useEffect } from 'react';
import notificationsData from '@/lib/notifications.json';

type Notification = {
    title: string;
    description: string;
    link?: string;
};

const NOTIFICATION_SESSION_KEY = 'app_notification_shown';

/**
 * A hook to manage displaying a single, rotating notification per browser session.
 * @returns {Notification | null} A notification object to display, or null if one has already been shown.
 */
export function useNotificationManager(): Notification | null {
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    // This effect should only run on the client
    const hasBeenShown = sessionStorage.getItem(NOTIFICATION_SESSION_KEY);

    if (!hasBeenShown) {
      // Pick a random notification
      const allNotifications = notificationsData.notifications;
      const randomIndex = Math.floor(Math.random() * allNotifications.length);
      const selectedNotification = allNotifications[randomIndex];
      
      setNotification(selectedNotification);

      // Mark that a notification has been shown for this session
      sessionStorage.setItem(NOTIFICATION_SESSION_KEY, 'true');
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return notification;
}
