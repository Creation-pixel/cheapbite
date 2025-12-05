
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyProfileRedirectPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until we have user info
    }

    if (!user) {
      // Not logged in, send to login page
      router.replace('/login');
    } else {
      // Logged in, redirect to the actual profile page using the UID
      router.replace(`/${user.uid}`);
    }
    
  }, [user, isUserLoading, router]);

  // Display a full-screen loading skeleton while redirecting.
  return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Loading your profile...</p>
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
      </div>
  );
}
