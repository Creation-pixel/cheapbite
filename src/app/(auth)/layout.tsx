
'use client';

import { type ReactNode, useState, useEffect, useMemo } from 'react';
import { Logo } from '@/components/logo';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [bgImage, setBgImage] = useState('');
  const [isClient, setIsClient] = useState(false);

  const authBackgrounds = useMemo(() => {
    return PlaceHolderImages.filter(img => img.id.startsWith('login-bg-')).map(img => img.imageUrl);
  }, []);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    // This prevents hydration mismatch errors.
    const randomImage = authBackgrounds[Math.floor(Math.random() * authBackgrounds.length)];
    setBgImage(randomImage);
    setIsClient(true);
  }, [authBackgrounds]);

  // Render a transition div to avoid flash of content
  if (!isClient) {
    return <div className="bg-background min-h-screen" />;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: `url(${bgImage})`,
          opacity: bgImage ? 1 : 0,
        }}
      />
      <div className="fixed inset-0 bg-black/50" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo className="text-3xl text-white" />
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
