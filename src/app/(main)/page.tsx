
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { type Post, type User, type PublicUserProfile } from '@/lib/types';
import { collection, orderBy, query, where, getDocs, doc, getDoc, limit, startAt, endAt } from 'firebase/firestore';
import { CreatePost } from '@/components/posts/create-post';
import { PostsList } from '@/components/posts/posts-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';


export default function HomePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [followingList, setFollowingList] = useState<string[] | null>(null);
  const [followingPosts, setFollowingPosts] = useState<Post[] | null>(null);
  const [isLoadingFollowingPosts, setIsLoadingFollowingPosts] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  const [searchedUsers, setSearchedUsers] = useState<PublicUserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  
  useEffect(() => {
    const fetchFollowingListAndPosts = async () => {
      if (!user || !firestore) {
        setFollowingList([]);
        setFollowingPosts([]);
        setIsLoadingFollowingPosts(false);
        return;
      }
      
      setIsLoadingFollowingPosts(true);

      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        const followedUIDs = userData.following || [];
        setFollowingList(followedUIDs);

        if (followedUIDs.length > 0) {
          const postsPromises = followedUIDs.map(uid => {
            const postsQuery = query(
              collection(firestore, 'posts'),
              where('authorId', '==', uid),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            return getDocs(postsQuery);
          });
          
          const postSnapshots = await Promise.all(postsPromises);
          const allPosts = postSnapshots.flatMap(snapshot => 
            snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post))
          );
          
          allPosts.sort((a, b) => (b.createdAt.seconds - a.createdAt.seconds));

          setFollowingPosts(allPosts);

        } else {
          setFollowingPosts([]);
        }

      } else {
        setFollowingList([]);
        setFollowingPosts([]);
      }
      setIsLoadingFollowingPosts(false);
    };

    fetchFollowingListAndPosts();
  }, [user, firestore]);

  // Debounced user search effect
  useEffect(() => {
        const handleUserSearch = async () => {
            if (!firestore || !searchTerm.trim()) {
                setSearchedUsers([]);
                setIsSearchingUsers(false);
                return;
            }
            setIsSearchingUsers(true);
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            
            try {
                const usersCol = collection(firestore, 'publicProfiles');
                const q = query(
                    usersCol,
                    orderBy('displayName_lowercase'),
                    startAt(lowerCaseSearchTerm),
                    endAt(lowerCaseSearchTerm + '\uf8ff'),
                    limit(20)
                );
        
                const querySnapshot = await getDocs(q);
                const usersList = querySnapshot.docs
                    .map(doc => ({ uid: doc.id, ...doc.data() } as PublicUserProfile));
                setSearchedUsers(usersList);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearchingUsers(false);
            }
        };

        const timeoutId = setTimeout(handleUserSearch, 300);
        return () => clearTimeout(timeoutId);

    }, [searchTerm, firestore]);
    

  const exploreQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'posts'),
        orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: explorePosts, isLoading: isLoadingExplore } = useCollection<Post>(exploreQuery);

  const filteredExplorePosts = useMemo(() => {
    if (!explorePosts) return [];
    if (!searchTerm) return explorePosts;
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return explorePosts.filter(post =>
      (post.content && post.content.toLowerCase().includes(lowercasedSearchTerm)) ||
      (post.author?.displayName && post.author.displayName.toLowerCase().includes(lowercasedSearchTerm)) ||
      (post.author?.username && post.author.username.toLowerCase().includes(lowercasedSearchTerm)) ||
      (post.recipe?.title && post.recipe.title.toLowerCase().includes(lowercasedSearchTerm)) ||
      (post.recipe?.ingredients && post.recipe.ingredients.some(ing => ing.toLowerCase().includes(lowercasedSearchTerm))) ||
      (post.tags && post.tags.some(tag => tag.toLowerCase().includes(lowercasedSearchTerm)))
    );
  }, [explorePosts, searchTerm]);
  
  const followingEmptyStateMessage = !followingList || followingList.length === 0
    ? "You're not following anyone yet! Check out the Explore tab to find new creators."
    : "This feed is quiet... for now.";
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">The CheapBite Feed</h1>
      
      <CreatePost />

      <form onSubmit={handleSearchSubmit} className="w-full">
          <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                  type="search"
                  placeholder="Search posts, users, recipes..."
                  className="w-full pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
      </form>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="explore">Explore</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="following">
           <PostsList 
              posts={followingPosts} 
              isLoading={isLoadingFollowingPosts} 
              emptyStateMessage={followingEmptyStateMessage} 
            />
        </TabsContent>
        <TabsContent value="explore">
            <PostsList posts={filteredExplorePosts} isLoading={isLoadingExplore} />
        </TabsContent>
         <TabsContent value="users">
            <div className="space-y-4">
                {isSearchingUsers ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : searchedUsers.length > 0 ? (
                    searchedUsers.map(u => (
                        <Link key={u.uid} href={`/${u.uid}`}>
                            <Card className="hover:bg-muted/50 transition-colors">
                                <div className="p-4 flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={u.photoURL ?? undefined} alt={u.displayName ?? undefined} />
                                        <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-semibold truncate">{u.displayName}</p>

                                        <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))
                ) : (
                     <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/50 p-12 text-center">
                        <h3 className="text-xl font-semibold">No Users Found</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {searchTerm ? "Try a different search term." : "Use the search bar above to find users."}
                        </p>
                    </div>
                )}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
