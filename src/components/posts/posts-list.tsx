
'use client';

import { PostCard } from './post-card';
import type { Post } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PostsListProps = {
  posts: Post[] | null;
  isLoading: boolean;
  emptyStateMessage?: string;
};

export function PostsList({ posts, isLoading, emptyStateMessage }: PostsListProps) {
  const [hostUrl, setHostUrl] = useState('');
  
  useEffect(() => {
    // Ensure this runs only on the client-side
    setHostUrl(window.location.origin);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/50 p-12 text-center">
          <h3 className="text-xl font-semibold">No posts yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyStateMessage || "Be the first to share something!"}
          </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          id={post.id}
          authorId={post.authorId}
          author={post.author}
          content={post.content}
          location={post.location}
          tags={post.tags}
          recipe={post.recipe}
          beverageRecipe={post.beverageRecipe}
          groceryList={post.groceryList}
          productLabel={post.productLabel}
          mediaURL={post.mediaURL}
          externalVideoUrl={post.externalVideoUrl}
          likeCount={post.likeCount}
          commentCount={post.commentCount}
          createdAt={(post.createdAt as any)?.toDate()} // Convert Firestore Timestamp to Date
          hostUrl={hostUrl}
        />
      ))}
    </div>
  );
}
