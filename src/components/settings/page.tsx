
'use client';

import { useUser, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, writeBatch } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useEffect, useState, useRef } from 'react';
import type { User } from '@/lib/types';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Moon, Sun, Camera, Save } from 'lucide-react';
import { useTheme } from 'next-themes';
import { getInitials } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const settingsSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  email: z.string().email(),
  bio: z.string().max(160, 'Bio must not be longer than 160 characters.').optional(),
  gender: z.enum(['male', 'female', 'other', 'unspecified']).optional(),
});

function ThemeSwitcher() {
  const { setTheme } = useTheme()

  return (
     <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred interface theme.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
            <Button variant="outline" onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" /> Light
            </Button>
            <Button variant="outline" onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" /> Dark
            </Button>
        </CardContent>
      </Card>
  )
}

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const userRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const publicProfileRef = useMemoFirebase(() => {
    if(!user) return null;
    return doc(firestore, 'publicProfiles', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      displayName: '',
      email: '',
      bio: '',
      gender: 'unspecified',
    }
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        displayName: userProfile.displayName ?? '',
        email: userProfile.email ?? '',
        bio: userProfile.bio ?? '',
        gender: userProfile.gender ?? 'unspecified',
      });
      setImagePreview(userProfile.photoURL || null);
    }
  }, [userProfile, form]);
  
  const handleImageFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveImage = async () => {
    if (!imageFile || !user || !firestore || !userRef || !publicProfileRef || !storage) {
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'No image selected or user not found.',
      });
      return;
    }
    
    setIsUploading(true);
    toast({ title: 'Uploading image...', description: 'Please wait.' });

    try {
      const filePath = `profile-images/${user.uid}/${Date.now()}-${imageFile.name}`;
      const imageStorageRef = storageRef(storage, filePath);
      
      await uploadBytes(imageStorageRef, imageFile);
      const downloadURL = await getDownloadURL(imageStorageRef);

      const batch = writeBatch(firestore);
      const updateData = { photoURL: downloadURL };
      batch.update(userRef, updateData);
      batch.update(publicProfileRef, updateData);

      batch.commit()
        .then(() => {
            setImageFile(null); 
            toast({
              title: 'Profile Picture Updated!',
              description: 'Your new profile picture is now live.',
            });
        })
        .catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: userRef.path,
              operation: 'update',
              requestResourceData: updateData
            }));
        })

    } catch (error) {
      console.error("Image upload failed:", error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'Something went wrong during the upload. Please try again.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    if (!userRef || !publicProfileRef || !userProfile) return;
    
    const batch = writeBatch(firestore);

    const privateUpdate = {
        displayName: values.displayName,
        bio: values.bio,
        gender: values.gender,
    };
    
    const publicUpdate = {
        displayName: values.displayName,
        bio: values.bio,
        gender: values.gender,
        displayName_lowercase: values.displayName.toLowerCase(),
        searchableTerms: [...new Set([
            ...values.displayName.toLowerCase().split(/\s+/),
            userProfile.username
        ])]
    };

    batch.update(userRef, privateUpdate);
    batch.update(publicProfileRef, publicUpdate);

    batch.commit()
      .then(() => {
        toast({
          title: 'Settings Saved',
          description: 'Your profile has been updated.',
        });
      })
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: privateUpdate,
        }));
      });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFileSelect} className="hidden" />
      <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">Settings</h1>
      <ThemeSwitcher />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information and profile picture.</CardDescription>
        </CardHeader>
        <CardContent>
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormItem>
                  <FormLabel>Profile Picture</FormLabel>
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="relative rounded-full">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src={imagePreview ?? undefined} alt={form.watch('displayName') ?? undefined} />
                                <AvatarFallback className="text-3xl">{getInitials(form.watch('displayName'))}</AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="h-6 w-6 text-white" />
                            </div>
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {imageFile && (
                        <>
                            <Button type="button" onClick={handleSaveImage} disabled={isUploading}>
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Image
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setImageFile(null); setImagePreview(userProfile?.photoURL || null); }}>
                                Cancel
                            </Button>
                        </>
                      )}
                    </div>
                  </div>
                   <FormDescription>Click the avatar to upload a new image.</FormDescription>
                </FormItem>
              
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
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select your gender" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="unspecified">Prefer not to say</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="your@email.com" {...field} disabled />
                      </FormControl>
                      <FormDescription>You cannot change your email address.</FormDescription>
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
                          placeholder="Tell us a little about yourself"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isUploading}>Save Changes</Button>
              </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}
