
'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useCallback } from 'react';
import { useUser, useFirestore, useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { user, isUserLoading, userError } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const handleNewUser = useCallback(async (user: FirebaseUser) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const username = user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || `user${user.uid.substring(0,5)}`;
      const usernameRef = doc(firestore, 'usernames', username);
      
      const batch = writeBatch(firestore);
      
      const displayName = user.displayName || user.email?.split('@')[0] || 'Anonymous User';
      const searchableTerms = [...new Set([
        ...displayName.toLowerCase().split(/\s+/),
        username
      ])].filter(Boolean);

      const newUserProfileData = {
        uid: user.uid,
        username: username,
        email: user.email,
        displayName: displayName,
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        bio: 'Just joined!',
        followers: [],
        following: [],
        followerCount: 0,
        followingCount: 0,
        accentColor: '#00BFFF',
      };
      
      const publicProfileData = {
        uid: user.uid,
        username: newUserProfileData.username,
        displayName: newUserProfileData.displayName,
        displayName_lowercase: newUserProfileData.displayName.toLowerCase(),
        photoURL: newUserProfileData.photoURL,
        bio: newUserProfileData.bio,
        followerCount: 0,
        followingCount: 0,
        searchableTerms: searchableTerms,
        accentColor: '#00BFFF',
      };

      const publicProfileRef = doc(firestore, 'publicProfiles', user.uid);

      batch.set(userRef, newUserProfileData);
      batch.set(publicProfileRef, publicProfileData);
      batch.set(usernameRef, { uid: user.uid });

      batch.commit()
        .then(() => {
            toast({ title: 'Welcome!', description: 'Your profile has been created.' });
        })
        .catch(async (serverError) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userRef.path,
            operation: 'create',
            requestResourceData: newUserProfileData,
          }));
      });
    }
  }, [firestore, toast]);


  useEffect(() => {
    if (!isUserLoading) {
      const isAuthPage = pathname === '/login' || pathname === '/signup';
      if (user) {
        handleNewUser(user);
        if (isAuthPage) {
          router.push('/');
        }
      } else if (!isAuthPage) {
        const publicPaths = ['/privacy-policy', '/terms-of-service', '/offer-help'];
        const isPublicRoute = publicPaths.includes(pathname) || /^\/[^/]+$/.test(pathname);

        if (!isPublicRoute) {
          router.push('/login');
        }
      }
    }
  }, [user, isUserLoading, pathname, router, handleNewUser]);

  useEffect(() => {
    if (userError) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: userError.message,
      });
    }
  }, [userError, toast]);

  return (
    <>
        {children}
    </>
  );
};

// Kept for backward compatibility if it's used elsewhere
export const useAuth = () => {
    const { user, isUserLoading } = useUser();
    return { user: user as (User | null), loading: isUserLoading };
};

export const useRequireAuth = () => {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !user) {
       // Allow unauthenticated access to the home page (and other public pages)
      const publicPaths = ['/privacy-policy', '/terms-of-service', '/offer-help'];
      const isPublicRoute = publicPaths.includes(pathname) || /^\/(profile)\/[^/]+$/.test(pathname) || pathname === '/';

      if (!isPublicRoute) {
          router.push('/login');
      }
    }
  }, [user, isUserLoading, router, pathname]);

  return { user, loading: isUserLoading };
};

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
