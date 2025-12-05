
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, writeBatch, arrayUnion, arrayRemove, getDoc, orderBy, Timestamp, updateDoc, increment } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PostsList } from '@/components/posts/posts-list';
import { type Post, type PublicUserProfile } from '@/lib/types';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useDoc } from '@/firebase/firestore/use-doc';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Palette, Link as LinkIcon, Users, MessageSquare, Save } from 'lucide-react';
import Link from 'next/link';
import { getInitials } from '@/lib/utils';


type ProfilePageProps = {
  params: {
    uid: string;
  };
};

const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  bio: z.string().max(250, 'Bio must not be longer than 250 characters.').optional(),
  photoURL: z.string().url('Please enter a valid URL.').optional().or(z.string().length(0)),
  coverPhotoUrl: z.string().url('Please enter a valid URL.').optional().or(z.string().length(0)),
  tagline: z.string().max(100, 'Tagline must not be longer than 100 characters.').optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Please enter a valid hex color.').optional(),
  websiteLink: z.string().url('Please enter a valid URL for your website.').optional().or(z.string().length(0)),
  socialLink: z.string().url('Please enter a valid URL for your social link.').optional().or(z.string().length(0)),
});

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState<{profile?: boolean, cover?: boolean}>({});
  const [imageFiles, setImageFiles] = useState<{profile?: File, cover?: File}>({});
  const [imagePreviews, setImagePreviews] = useState<{profile?: string, cover?: string}>({});

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      bio: '',
      photoURL: '',
      coverPhotoUrl: '',
      tagline: '',
      accentColor: '',
      websiteLink: '',
      socialLink: '',
    },
  });
  
  const publicProfileRef = useMemoFirebase(() => {
    if (!firestore || !uid) return null;
    return doc(firestore, 'publicProfiles', uid);
  }, [firestore, uid]);

  const { data: profile, isLoading: isLoadingProfile, error } = useDoc<PublicUserProfile>(publicProfileRef);

  useEffect(() => {
      if (profile) {
        form.reset({
           displayName: profile.displayName || '',
           bio: profile.bio || '',
           photoURL: profile.photoURL || '',
           coverPhotoUrl: profile.coverPhotoUrl || '',
           tagline: profile.tagline || '',
           accentColor: profile.accentColor || '#00BFFF',
           websiteLink: profile.websiteLink || '',
           socialLink: profile.socialLink || '',
        });
        setImagePreviews({
          profile: profile.photoURL || undefined,
          cover: profile.coverPhotoUrl || undefined
        });
      }
  }, [profile, form]);

  useEffect(() => {
    const checkFollowing = async () => {
        if (!currentUser || !profile || !firestore || currentUser.uid === profile.uid) return;
        
        const privateUserRef = doc(firestore, 'users', currentUser.uid);
        const privateUserSnap = await getDoc(privateUserRef);
        if (privateUserSnap.exists() && (privateUserSnap.data().following as string[])?.includes(profile.uid)) {
            setIsFollowing(true);
        } else {
            setIsFollowing(false);
        }
    }
    checkFollowing();
  }, [currentUser, profile, firestore]);


  const postsQuery = useMemoFirebase(() => {
    if (!firestore || !profile) return null;
    return query(collection(firestore, 'posts'), where('authorId', '==', profile.uid), orderBy('createdAt', 'desc'));
  }, [firestore, profile]);

  const { data: posts, isLoading: isLoadingPosts } = useCollection<Post>(postsQuery);
  
  const handleFollowToggle = async () => {
    if (!currentUser || !profile || !firestore || currentUser.uid === profile.uid) return;

    const currentUserPrivateRef = doc(firestore, 'users', currentUser.uid);
    const currentUserPublicRef = doc(firestore, 'publicProfiles', currentUser.uid);
    const targetUserPublicRef = doc(firestore, 'publicProfiles', profile.uid);
    
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    const batch = writeBatch(firestore);
    const followingUpdate = { following: wasFollowing ? arrayRemove(profile.uid) : arrayUnion(profile.uid) };
    const followingCountUpdate = { followingCount: increment(wasFollowing ? -1 : 1) };
    const followerCountUpdate = { followerCount: increment(wasFollowing ? -1 : 1) };

    batch.update(currentUserPrivateRef, followingUpdate);
    batch.update(currentUserPublicRef, followingCountUpdate);
    batch.update(targetUserPublicRef, followerCountUpdate);
    
    batch.commit()
      .then(() => {
        toast({
            description: wasFollowing
            ? `You are no longer following @${profile.username}`
            : `You are now following @${profile.username}`,
        });
      })
      .catch(async (serverError) => {
        setIsFollowing(wasFollowing); // Revert optimistic UI on failure
        
        // Emit a detailed contextual error
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: targetUserPublicRef.path, // The likely point of failure is writing to another user's doc
            operation: 'update',
            requestResourceData: followerCountUpdate 
        }));
        
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update your follow status.' });
    });
  };

  const handleImageFileSelect = (event: React.ChangeEvent<HTMLInputElement>, imageType: 'profile' | 'cover') => {
      const file = event.target.files?.[0];
      if (file) {
        setImageFiles(prev => ({ ...prev, [imageType]: file }));
        const reader = new FileReader();
        reader.onloadend = () => {
          const url = reader.result as string;
          setImagePreviews(prev => ({ ...prev, [imageType]: url }));
        };
        reader.readAsDataURL(file);
      }
  };

  const handleImageSave = async (imageType: 'profile' | 'cover') => {
    const fileToUpload = imageFiles[imageType];
    if (!fileToUpload || !currentUser || !firestore || !storage) {
        toast({ variant: 'destructive', title: 'Upload Error', description: 'No image selected or user not found.' });
        return;
    }

    setIsUploading(prev => ({...prev, [imageType]: true}));
    toast({ title: `Uploading ${imageType === 'profile' ? 'profile picture' : 'banner'}...` });

    try {
        const folder = imageType === 'profile' ? 'profile-images' : 'cover-photos';
        const filePath = `${folder}/${currentUser.uid}/${Date.now()}-${fileToUpload.name}`;
        const imageStorageRef = storageRef(storage, filePath);

        await uploadBytes(imageStorageRef, fileToUpload);
        const downloadURL = await getDownloadURL(imageStorageRef);

        const batch = writeBatch(firestore);
        const privateUserRef = doc(firestore, 'users', currentUser.uid);
        const publicUserRef = doc(firestore, 'publicProfiles', currentUser.uid);
        const updateData = imageType === 'profile' ? { photoURL: downloadURL } : { coverPhotoUrl: downloadURL };
        
        batch.update(privateUserRef, updateData);
        batch.update(publicUserRef, updateData);

        await batch.commit();

        setImageFiles(prev => ({ ...prev, [imageType]: undefined }));
        form.setValue(imageType === 'profile' ? 'photoURL' : 'coverPhotoUrl', downloadURL);

        toast({ title: 'Image Updated!', description: 'Your new image has been saved.' });
    } catch (error) {
        console.error("Image upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not save your new image.' });
    } finally {
        setIsUploading(prev => ({...prev, [imageType]: false}));
    }
  };

  const handleProfileUpdate = async (values: z.infer<typeof profileFormSchema>) => {
    if (!currentUser || !profile || !firestore || currentUser.uid !== profile.uid) return;
    
    const batch = writeBatch(firestore);
    
    const publicUserRef = doc(firestore, 'publicProfiles', currentUser.uid);
    const privateUserRef = doc(firestore, 'users', currentUser.uid);

    const publicUpdateData = {
        displayName: values.displayName,
        displayName_lowercase: values.displayName.toLowerCase(),
        bio: values.bio,
        tagline: values.tagline,
        accentColor: values.accentColor,
        searchableTerms: [...new Set([
            ...values.displayName.toLowerCase().split(/\s+/),
            profile.username
          ])].filter(Boolean),
        websiteLink: values.websiteLink,
        socialLink: values.socialLink,
    };
    
    const privateUpdateData = {
        displayName: values.displayName,
        bio: values.bio,
        tagline: values.tagline,
        accentColor: values.accentColor,
        websiteLink: values.websiteLink,
        socialLink: values.socialLink,
    };

    batch.update(publicUserRef, publicUpdateData);
    batch.update(privateUserRef, privateUpdateData);
    
    batch.commit()
      .then(() => {
        toast({
            title: 'Profile Updated',
            description: 'Your changes have been saved.',
        });
        setIsEditDialogOpen(false);
      })
      .catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: publicUserRef.path,
            operation: 'update',
            requestResourceData: publicUpdateData
        }));
      });
  };
  
  const handleMessage = () => {
    if (!profile) return;
    router.push(`/messages?u=${profile.uid}`);
  };

  if (isLoadingProfile) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="relative h-48 w-full rounded-lg bg-muted overflow-hidden">
            <Skeleton className="h-full w-full" />
        </div>
        <div className="-mt-16 ml-6 flex items-end gap-4">
             <Skeleton className="h-24 w-24 rounded-full border-4 border-card" />
             <div className="flex-1 pb-2 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-32" />
             </div>
        </div>
        <div className="space-y-4 pt-4">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-destructive">User profile could not be loaded.</div>;
  }

  if (!profile) {
    return <div className="text-center">User not found.</div>;
  }
  
  const isOwnProfile = currentUser?.uid === profile.uid;

  return (
    <>
    <div className="mx-auto max-w-4xl space-y-8">
       <input type="file" accept="image/*" ref={profileFileInputRef} onChange={(e) => handleImageFileSelect(e, 'profile')} className="hidden" />
       <input type="file" accept="image/*" ref={coverFileInputRef} onChange={(e) => handleImageFileSelect(e, 'cover')} className="hidden" />
       
      <Card className="overflow-hidden">
        <div className="relative h-32 md:h-48 bg-muted" style={{ backgroundColor: profile.accentColor || undefined }}>
            {profile.coverPhotoUrl ? <Image src={profile.coverPhotoUrl} alt="Cover photo" fill style={{objectFit: 'cover'}} data-ai-hint="background pattern" /> : <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20"></div>}
        </div>
        <CardHeader className="p-6 pt-0">
          <div className="flex items-end gap-4 -mt-12">
            <div className="relative">
                <Dialog>
                    <DialogTrigger asChild>
                         <Avatar className="h-24 w-24 border-4 border-card bg-background">
                          <AvatarImage src={profile.photoURL ?? undefined} alt={profile.displayName ?? undefined} />
                          <AvatarFallback className="text-3xl">{getInitials(profile.displayName)}</AvatarFallback>
                        </Avatar>
                    </DialogTrigger>
                    {profile.photoURL && (
                        <DialogContent className="p-0 border-0 max-w-lg">
                            <DialogHeader className="sr-only">
                              <DialogTitle>Enlarged profile picture</DialogTitle>
                              <DialogDescription>A larger view of {profile.displayName}'s profile picture.</DialogDescription>
                            </DialogHeader>
                            <Image src={profile.photoURL} alt={profile.displayName || 'Profile picture'} width={512} height={512} className="rounded-lg object-contain" />
                        </DialogContent>
                    )}
                </Dialog>
            </div>
            <div className="flex-1 pb-1">
                 <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                 <p className="text-sm text-muted-foreground">@{profile.username}</p>
                 {profile.tagline && <p className="text-sm italic mt-1" style={{ color: profile.accentColor || undefined }}>"{profile.tagline}"</p>}
            </div>
             <div className="flex items-center gap-2">
                {isOwnProfile ? (
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                        <Button variant="outline">Edit Profile</Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Edit Your Profile</DialogTitle>
                                <DialogDescription>
                                    Make changes to your public profile. Click save when you're done.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleProfileUpdate)} className="space-y-6 py-4">
                                <div className="space-y-2">
                                    <FormLabel>Profile Picture</FormLabel>
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-20 w-20">
                                            <AvatarImage src={imagePreviews.profile ?? undefined} alt={form.watch('displayName') ?? undefined} data-ai-hint="person portrait"/>
                                            <AvatarFallback className="text-3xl">{getInitials(form.watch('displayName'))}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" size="sm" onClick={() => profileFileInputRef.current?.click()} disabled={isUploading.profile}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Change
                                            </Button>
                                            {imageFiles.profile && (
                                                <Button type="button" size="sm" variant="secondary" onClick={() => handleImageSave('profile')} disabled={isUploading.profile}>
                                                    {isUploading.profile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Save Image
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <FormLabel>Banner Image</FormLabel>
                                    <div className="relative aspect-video w-full bg-muted rounded-md overflow-hidden">
                                        {imagePreviews.cover ? <Image src={imagePreviews.cover} alt="Cover photo preview" fill style={{objectFit: 'cover'}} /> : <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent/10"></div>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button type="button" size="sm" onClick={() => coverFileInputRef.current?.click()} disabled={isUploading.cover}>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Change
                                        </Button>
                                        {imageFiles.cover && (
                                            <Button type="button" size="sm" variant="secondary" onClick={() => handleImageSave('cover')} disabled={isUploading.cover}>
                                                {isUploading.cover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                                Save Banner
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                    <FormField
                                        control={form.control}
                                        name="displayName"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Display Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Your Name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="tagline"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Tagline</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Your catchy tagline" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="bio"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Bio</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Tell everyone a little bit about yourself"
                                                    className="resize-none"
                                                    maxLength={250}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    
                                    <FormField
                                        control={form.control}
                                        name="accentColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Accent Color</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                <Palette className="h-5 w-5 text-muted-foreground" />
                                                <Input type="color" {...field} className="w-12 h-10 p-1" />
                                                <Input placeholder="#00BFFF" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="websiteLink"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Website / Store Link</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <LinkIcon className="h-5 w-5 text-muted-foreground" />
                                                    <Input placeholder="https://your-website.com" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="socialLink"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Social Media Link</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-5 w-5 text-muted-foreground" />
                                                    <Input placeholder="https://instagram.com/your-profile" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <DialogFooter>
                                        <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={isUploading.profile || isUploading.cover}>
                                        Save Changes
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                ) : (
                    <>
                        <Button variant="outline" onClick={handleMessage}>
                            <MessageSquare className="mr-2 h-4 w-4" /> Message
                        </Button>
                        <Button onClick={handleFollowToggle}>
                            {isFollowing ? 'Unfollow' : 'Follow'}
                        </Button>
                    </>
                )}
            </div>
          </div>
          <p className="pt-4">{profile.bio}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
              <p><span className="font-bold text-foreground">{profile.followerCount || 0}</span> Followers</p>
              <p><span className="font-bold text-foreground">{profile.followingCount || 0}</span> Following</p>
              {profile.websiteLink && (
                  <Link href={profile.websiteLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary hover:underline">
                      <LinkIcon className="h-4 w-4" />
                      <span className="font-medium text-foreground truncate">{profile.websiteLink.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]}</span>
                  </Link>
              )}
               {profile.socialLink && (
                  <Link href={profile.socialLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary hover:underline">
                      <Users className="h-4 w-4" />
                      <span className="font-medium text-foreground truncate">{profile.socialLink.replace(/^(https:?:\/\/)?(www\.)?/, '').split('/')[0]}</span>
                  </Link>
              )}
          </div>
        </CardHeader>
      </Card>
      
      <div>
        <h1 className="text-xl font-bold mb-4">Posts</h1>
        <PostsList posts={posts} isLoading={isLoadingPosts} />
      </div>
    </div>
    </>
  );
}
