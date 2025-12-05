
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, Calendar, Settings, UtensilsCrossed, Bookmark, CalendarPlus, Martini, User, ShoppingCart, Search, ScanLine, Handshake, PlusSquare } from 'lucide-react';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { UserMenu } from '@/components/user-menu';
import { NotificationCenter } from './notification-center';
import { Button } from './ui/button';
import { Sheet, SheetTrigger, SheetContent } from './ui/sheet';
import { Menu } from 'lucide-react';

export function HorizontalNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: user ? `/${user.uid}` : '/my-profile', icon: User, label: 'My Profile' },
    { href: '/recipes', icon: UtensilsCrossed, label: 'Recipes' },
    { href: '/drinks', icon: Martini, label: 'Drinks' },
    { href: '/grocery', icon: ShoppingCart, label: 'Grocery List' },
    { href: '/product-label', icon: ScanLine, label: 'Product Scanner' },
    { href: '/saved', icon: Bookmark, label: 'Saved' },
    { href: '/meal-planner', icon: CalendarPlus, label: 'Meal Planner' },
    { href: '/messages', icon: MessageCircle, label: 'Messages' },
    { href: '/events', icon: Calendar, label: 'Events' },
  ];
  
  const secondaryNavItems = [
     { href: '/offer-help', icon: Handshake, label: 'Offer Help' },
     { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string; }) => {
    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
        <Link
            href={href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
            'flex items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary',
            { 'bg-primary/10 text-primary': isActive }
            )}
        >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </Link>
    );
  }
  
  const allNavItems = [...navItems, ...secondaryNavItems];

  return (
     <header className="sticky top-0 z-40 w-full border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <Logo />
            {/* Desktop Icons */}
            <div className="hidden md:flex items-center gap-4">
                <NotificationCenter />
                <UserMenu />
            </div>
            {/* Mobile Icons & Menu */}
            <div className="flex items-center gap-2 md:hidden">
                 <NotificationCenter />
                 <UserMenu />
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-6 w-6" />
                            <span className="sr-only">Open Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64">
                         <div className="p-4">
                            <Logo />
                         </div>
                         <nav className="flex flex-col gap-2 p-2">
                             {allNavItems.map(item => <NavLink key={item.label} {...item} />)}
                         </nav>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
        <nav className="hidden md:flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t bg-card/80 px-4 py-2 backdrop-blur-sm">
            {navItems.map((item) => (
                <NavLink key={item.label} {...item} />
            ))}
            <div className="w-px h-6 bg-border mx-2"></div>
             {secondaryNavItems.map((item) => (
                <NavLink key={item.label} {...item} />
            ))}
        </nav>
     </header>
  );
}
