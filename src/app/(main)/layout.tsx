
'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/context/auth-context';
import { HorizontalNav } from '@/components/horizontal-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { RecipeProvider } from '@/context/recipe-context';
import { Footer } from '@/components/footer';
import { Toaster } from '@/components/ui/toaster';
import { NotificationDialog } from '@/components/notification-dialog';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useRequireAuth();
  const [showLoading, setShowLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Only show loading state on the client after a very brief delay.
    // This prevents hydration mismatch errors.
    if (!loading) {
      setShowLoading(false);
    }
  }, [loading]);
  
  const lightBg = "url('https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2Fyes_light_Image_4vj3ms4vj3ms4vj3.png?alt=media&token=9236a891-7828-45bd-bcd8-41fce4052950')";
  const darkBg = "url('https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FYes_Real_Dark__Image_37p4k637p4k637p4.png?alt=media&token=491a6601-a855-4e3c-8a89-a833ff791860')";


  if (loading || !user) {
    // Render a loading skeleton only on the client. The server will render nothing here.
    return showLoading ? (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
      </div>
    ) : null;
  }

  return (
    <RecipeProvider>
      <div className="flex min-h-screen w-full flex-col">
        <HorizontalNav />
        <div 
          className="flex-1 w-full bg-cover bg-center bg-fixed"
          style={{ backgroundImage: resolvedTheme === 'dark' ? darkBg : lightBg }}
        >
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
        <Footer />
        <Toaster />
        <NotificationDialog />
      </div>
    </RecipeProvider>
  );
}
