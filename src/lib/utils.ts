import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (name?: string | null): string => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return 'U'; // Default for "User"
  }
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length > 1 && nameParts[1]) {
    // Has at least two parts, like "John Doe"
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  }
  if (nameParts[0].length > 1) {
    // Has one part with more than one character, like "John"
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  // Has one part with one character, like "J"
  return nameParts[0].toUpperCase();
};
