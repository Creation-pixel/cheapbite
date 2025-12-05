import Link from 'next/link';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        'flex items-center gap-2 text-xl font-bold text-primary dark:text-white',
        className
      )}
    >
      <div className="rounded-lg bg-primary p-2 text-primary-foreground">
        <UtensilsCrossed className="h-6 w-6" />
      </div>
      <span className="font-headline">CheapBite</span>
    </Link>
  );
}
