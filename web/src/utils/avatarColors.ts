/**
 * Avatar color utilities based on username prefix
 * - Za => pink/red (Zahra)
 * - Sa => green/yellow (Salman)
 * - Ma => blue (Maytham)
 * - Mu => orange (Mujtaba)
 */

export type AvatarColorScheme = {
  gradient: string;
  bg: string;
  text: string;
};

const colorSchemes: Record<string, AvatarColorScheme> = {
  za: {
    gradient: 'bg-gradient-to-br from-pink-400 to-rose-600',
    bg: 'bg-pink-100',
    text: 'text-pink-600',
  },
  sa: {
    gradient: 'bg-gradient-to-br from-emerald-400 to-green-600',
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
  },
  ma: {
    gradient: 'bg-gradient-to-br from-blue-400 to-indigo-600',
    bg: 'bg-blue-100',
    text: 'text-blue-600',
  },
  mu: {
    gradient: 'bg-gradient-to-br from-orange-400 to-amber-600',
    bg: 'bg-orange-100',
    text: 'text-orange-600',
  },
};

// Default fallback color (lapis theme)
const defaultScheme: AvatarColorScheme = {
  gradient: 'bg-gradient-to-br from-lapis-400 to-lapis-600',
  bg: 'bg-lapis-100',
  text: 'text-lapis-600',
};

/**
 * Get avatar color scheme based on username or full name
 */
export function getAvatarColorScheme(name: string | undefined | null): AvatarColorScheme {
  if (!name) return defaultScheme;
  
  const prefix = name.toLowerCase().slice(0, 2);
  return colorSchemes[prefix] || defaultScheme;
}

/**
 * Get initials from a name (first letter of first and last name, or first two letters)
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
