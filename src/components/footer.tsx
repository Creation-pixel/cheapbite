import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-primary/10 px-4 py-6 sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-sm text-muted-foreground md:flex-row">
        <p>Product of Cheap Bite Garden Restaurant & Bar &copy; 2025</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy-policy" className="hover:text-primary hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-primary hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
